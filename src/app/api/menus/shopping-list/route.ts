import { NextResponse } from "next/server";
import { startOfWeek } from "date-fns";
import { prisma } from "@/lib/prisma";
import { requireApiHousehold } from "@/lib/auth";
import { buildShoppingList } from "@/lib/menus/openai";
import { normalizeIngredientKey } from "@/lib/menus/default-prices";
import {
  estimateLineCost,
  type CatalogPriceUnit,
} from "@/lib/menus/aggregate-quantities";

export const dynamic = "force-dynamic";

function asPriceUnit(raw: string | null | undefined): CatalogPriceUnit {
  if (raw === "kg" || raw === "l" || raw === "ud") return raw;
  return "ud";
}

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
  const savedMap = new Map(
    saved.map((s) => [
      s.nameKey,
      {
        unitPrice: Number(s.unitPrice),
        priceUnit: asPriceUnit(s.priceUnit),
      },
    ])
  );

  const items = baseItems.map((item) => {
    const nameKey = normalizeIngredientKey(item.name);
    const savedPrice = savedMap.get(nameKey);
    // Solo precios guardados por el hogar (tickets / manual). Sin defaults inventados.
    const unitPrice = savedPrice?.unitPrice ?? null;
    const priceUnit = savedPrice?.priceUnit ?? "ud";
    const lineEstimate =
      unitPrice != null
        ? estimateLineCost({
            quantities: item.quantities,
            totalQty: item.totalQty,
            unitPrice,
            priceUnit,
            name: item.name,
          })
        : null;

    return {
      ...item,
      nameKey,
      unitPrice,
      priceUnit,
      lineEstimate,
      source: savedPrice != null ? ("saved" as const) : null,
    };
  });

  const estimatedTotal = items.reduce(
    (sum, item) => sum + (item.lineEstimate ?? 0),
    0
  );
  const pricedCount = items.filter((i) => i.lineEstimate != null).length;

  return NextResponse.json({
    items,
    weekStart,
    estimatedTotal: Math.round(estimatedTotal * 100) / 100,
    pricedCount,
  });
}
