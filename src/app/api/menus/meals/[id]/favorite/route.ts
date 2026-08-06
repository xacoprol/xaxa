import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiHousehold } from "@/lib/auth";

type Params = { params: { id: string } };

export async function PATCH(_req: Request, { params }: Params) {
  const { ctx, error } = await requireApiHousehold();
  if (error || !ctx) return error!;

  const meal = await prisma.meal.findFirst({
    where: {
      id: params.id,
      weeklyMenu: { householdId: ctx.household.id },
    },
  });

  if (!meal) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  const nextFavorite = !meal.isFavorite;
  const updated = await prisma.meal.update({
    where: { id: meal.id },
    data: {
      isFavorite: nextFavorite,
      favoritedById: nextFavorite ? ctx.user.id : null,
    },
  });

  return NextResponse.json({ meal: updated });
}
