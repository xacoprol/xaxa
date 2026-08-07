import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiHousehold } from "@/lib/auth";
import { attachMealImage } from "@/lib/menus/images";
import { z } from "zod";

export const maxDuration = 60;

/** Genera fotos para comidas sin imageUrl (por ids). */
export async function POST(request: Request) {
  const { ctx, error } = await requireApiHousehold();
  if (error || !ctx) return error!;

  const schema = z.object({
    mealIds: z.array(z.string()).optional(),
    limit: z.number().int().min(1).max(6).optional(),
    /** Regenerar aunque ya tenga imageUrl */
    force: z.boolean().optional(),
  });
  const body = schema.safeParse(await request.json().catch(() => ({})));
  if (!body.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const limit = body.data.limit ?? 2;
  const force = body.data.force === true && !!body.data.mealIds?.length;

  const meals = await prisma.meal.findMany({
    where: {
      weeklyMenu: { householdId: ctx.household.id },
      ...(force ? {} : { imageUrl: null }),
      ...(body.data.mealIds?.length
        ? { id: { in: body.data.mealIds } }
        : {}),
    },
    orderBy: [{ dayOfWeek: "asc" }, { mealType: "asc" }],
    take: force ? Math.min(limit, body.data.mealIds!.length) : limit,
  });

  if (!meals.length) {
    return NextResponse.json({
      updated: [],
      remaining: 0,
      done: true,
      error: "No hay platos pendientes de foto",
    });
  }

  const updated: { id: string; imageUrl: string; source: string }[] = [];
  const errors: string[] = [];

  for (const meal of meals) {
    try {
      const { imageUrl, source } = await attachMealImage({
        householdId: ctx.household.id,
        mealId: meal.id,
        name: meal.name,
        tags: meal.tags,
        // force = regenerar a mano → probar stock otra vez; si falla, IA
        preferAi: false,
      });
      await prisma.meal.update({
        where: { id: meal.id },
        data: { imageUrl },
      });
      updated.push({ id: meal.id, imageUrl, source });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Error generando foto";
      console.error("[menus/images]", meal.id, message);
      errors.push(`${meal.name}: ${message}`);
    }
  }

  const remaining = await prisma.meal.count({
    where: {
      weeklyMenu: { householdId: ctx.household.id },
      imageUrl: null,
      ...(body.data.mealIds?.length
        ? { id: { in: body.data.mealIds } }
        : {}),
    },
  });

  if (!updated.length && errors.length) {
    return NextResponse.json(
      { error: errors[0], updated: [], remaining, done: false },
      { status: 502 }
    );
  }

  return NextResponse.json({
    updated,
    remaining,
    done: remaining === 0,
    errors: errors.length ? errors : undefined,
  });
}
