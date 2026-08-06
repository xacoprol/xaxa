import { NextResponse } from "next/server";
import { startOfWeek } from "date-fns";
import { prisma } from "@/lib/prisma";
import { requireApiHousehold } from "@/lib/auth";
import { buildShoppingList } from "@/lib/menus/openai";

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
    return NextResponse.json({ items: [], weekStart });
  }

  const items = buildShoppingList(menu.meals.map((m) => m.ingredients));
  return NextResponse.json({ items, weekStart });
}
