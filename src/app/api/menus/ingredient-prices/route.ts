import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireApiHousehold } from "@/lib/auth";
import { normalizeIngredientKey } from "@/lib/menus/default-prices";

export const dynamic = "force-dynamic";

export async function PUT(request: Request) {
  const { ctx, error } = await requireApiHousehold();
  if (error || !ctx) return error!;

  const schema = z.object({
    name: z.string().min(1),
    unitPrice: z.number().min(0).max(9999),
  });
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const nameKey = normalizeIngredientKey(parsed.data.name);
  const price = await prisma.ingredientPrice.upsert({
    where: {
      householdId_nameKey: {
        householdId: ctx.household.id,
        nameKey,
      },
    },
    create: {
      householdId: ctx.household.id,
      nameKey,
      name: parsed.data.name.trim(),
      unitPrice: parsed.data.unitPrice,
    },
    update: {
      name: parsed.data.name.trim(),
      unitPrice: parsed.data.unitPrice,
    },
  });

  return NextResponse.json({
    price: {
      name: price.name,
      nameKey: price.nameKey,
      unitPrice: Number(price.unitPrice),
    },
  });
}
