import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiHousehold } from "@/lib/auth";
import { attachMealImage } from "@/lib/menus/images";
import { z } from "zod";

export const maxDuration = 60;

/** Genera fotos para comidas sin imageUrl (por ids o por weekStart). */
export async function POST(request: Request) {
  const { ctx, error } = await requireApiHousehold();
  if (error || !ctx) return error!;

  const schema = z.object({
    mealIds: z.array(z.string()).optional(),
    limit: z.number().int().min(1).max(6).optional(),
  });
  const body = schema.safeParse(await request.json().catch(() => ({})));
  if (!body.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const limit = body.data.limit ?? 2;
  const meals = await prisma.meal.findMany({
    where: {
      weeklyMenu: { householdId: ctx.household.id },
      imageUrl: null,
      ...(body.data.mealIds?.length
        ? { id: { in: body.data.mealIds } }
        : {}),
    },
    orderBy: [{ dayOfWeek: "asc" }, { mealType: "asc" }],
    take: limit,
  });

  const updated: { id: string; imageUrl: string }[] = [];

  for (const meal of meals) {
    const imageUrl = await attachMealImage({
      householdId: ctx.household.id,
      mealId: meal.id,
      name: meal.name,
      tags: meal.tags,
    });
    if (!imageUrl) continue;
    await prisma.meal.update({
      where: { id: meal.id },
      data: { imageUrl },
    });
    updated.push({ id: meal.id, imageUrl });
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

  return NextResponse.json({
    updated,
    remaining,
    done: remaining === 0,
  });
}
