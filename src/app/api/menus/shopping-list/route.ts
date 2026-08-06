import { NextResponse } from "next/server";
import { startOfWeek } from "date-fns";
import { prisma } from "@/lib/prisma";
import { requireApiHousehold } from "@/lib/auth";
import { buildShoppingList } from "@/lib/menus/openai";
import {
  lookupDefaultPrice,
  normalizeIngredientKey,
} from "@/lib/menus/default-prices";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { ctx, error } = await requireApiHousehold();
  if (error || !ctx) return error!;

  const { searchParams } = new URL(request.url);
  const weekParam = searchParams.get("weekStart");
  const weekStart = weekParam
    ? new Date(weekParam)
    : startOfWeek(new Date(), { weekStartsOn: 1 });

  const menu = await prisma.weeklyMenu.findUnique({
    where: {
      householdId_weekStart: {
        householdId: ctx.household.id,
        weekStart,
      },
    },
    include: { meals: true },
  });

  if (!menu) {
    return NextResponse.json({
      items: [],
      weekStart,
      estimatedTotal: 0,
      pricedCount: 0,
    });
  }

  const baseItems = buildShoppingList(menu.meals.map((m) => m.ingredients));
  const keys = baseItems.map((i) => normalizeIngredientKey(i.name));

  const saved = await prisma.ingredientPrice.findMany({
    where: {
      householdId: ctx.household.id,
      nameKey: { in: keys },
    },
  });
  const savedMap = new Map(saved.map((s) => [s.nameKey, Number(s.unitPrice)]));

  const items = baseItems.map((item) => {
    const nameKey = normalizeIngredientKey(item.name);
    const savedPrice = savedMap.get(nameKey);
    const defaultPrice = lookupDefaultPrice(item.name);
    const unitPrice = savedPrice ?? defaultPrice;
    const source: "saved" | "default" | null =
      savedPrice != null ? "saved" : defaultPrice != null ? "default" : null;

    return {
      ...item,
      nameKey,
      unitPrice,
      source,
    };
  });

  const estimatedTotal = items.reduce(
    (sum, item) => sum + (item.unitPrice ?? 0),
    0
  );
  const pricedCount = items.filter((i) => i.unitPrice != null).length;

  return NextResponse.json({
    items,
    weekStart,
    estimatedTotal: Math.round(estimatedTotal * 100) / 100,
    pricedCount,
  });
}
