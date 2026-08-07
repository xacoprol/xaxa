import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiHousehold } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Detalle de un plato (ingredientes + pasos) bajo demanda. */
export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const { ctx, error } = await requireApiHousehold();
  if (error || !ctx) return error!;

  const meal = await prisma.meal.findFirst({
    where: {
      id: params.id,
      weeklyMenu: { householdId: ctx.household.id },
    },
  });

  if (!meal) {
    return NextResponse.json({ error: "Plato no encontrado" }, { status: 404 });
  }

  return NextResponse.json({
    meal: {
      id: meal.id,
      dayOfWeek: meal.dayOfWeek,
      mealType: meal.mealType,
      name: meal.name,
      description: meal.description,
      ingredients: meal.ingredients,
      steps: meal.steps,
      servings: meal.servings,
      difficulty: meal.difficulty,
      tags: meal.tags,
      imageUrl: meal.imageUrl,
      prepMins: meal.prepMins,
      cookMins: meal.cookMins,
      estimatedMins: meal.estimatedMins,
      isFavorite: meal.isFavorite,
    },
  });
}
