import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiHousehold } from "@/lib/auth";
import type { Prisma } from "@prisma/client";

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

  if (nextFavorite) {
    await prisma.recipe.upsert({
      where: {
        householdId_name: {
          householdId: ctx.household.id,
          name: meal.name,
        },
      },
      create: {
        householdId: ctx.household.id,
        name: meal.name,
        description: meal.description,
        ingredients: meal.ingredients as Prisma.InputJsonValue,
        steps: meal.steps,
        servings: meal.servings,
        difficulty: meal.difficulty,
        tags: meal.tags,
        imageUrl: meal.imageUrl,
        prepMins: meal.prepMins,
        cookMins: meal.cookMins,
        estimatedMins: meal.estimatedMins,
        sourceMealId: meal.id,
      },
      update: {
        description: meal.description,
        ingredients: meal.ingredients as Prisma.InputJsonValue,
        steps: meal.steps,
        servings: meal.servings,
        difficulty: meal.difficulty,
        tags: meal.tags,
        imageUrl: meal.imageUrl ?? undefined,
        prepMins: meal.prepMins,
        cookMins: meal.cookMins,
        estimatedMins: meal.estimatedMins,
        sourceMealId: meal.id,
      },
    });
  } else {
    // Solo quita el flag de la semana; la receta permanece en la biblioteca
  }

  return NextResponse.json({ meal: updated });
}
