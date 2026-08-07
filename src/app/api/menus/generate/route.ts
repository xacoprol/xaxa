import { NextResponse } from "next/server";
import { startOfWeek } from "date-fns";
import { prisma } from "@/lib/prisma";
import { requireApiHousehold } from "@/lib/auth";
import { generateWeeklyMeals } from "@/lib/menus/openai";
import { z } from "zod";
import type { MealDifficulty, Prisma } from "@prisma/client";

function monday(date = new Date()) {
  return startOfWeek(date, { weekStartsOn: 1 });
}

function mealRow(
  weeklyMenuId: string,
  m: {
    dayOfWeek: number;
    mealType: "DESAYUNO" | "COMIDA" | "CENA";
    name: string;
    description?: string;
    ingredients: unknown;
    steps: string[];
    servings?: number;
    difficulty?: string;
    tags?: string[];
    prepMins?: number;
    cookMins?: number;
    estimatedMins?: number;
  }
): Prisma.MealCreateManyInput {
  return {
    weeklyMenuId,
    dayOfWeek: m.dayOfWeek,
    mealType: m.mealType,
    name: m.name,
    description: m.description ?? null,
    ingredients: m.ingredients as Prisma.InputJsonValue,
    steps: m.steps,
    servings: m.servings ?? 2,
    difficulty: (m.difficulty ?? "MEDIA") as MealDifficulty,
    tags: m.tags ?? [],
    prepMins: m.prepMins ?? null,
    cookMins: m.cookMins ?? null,
    estimatedMins: m.estimatedMins ?? null,
  };
}

export async function GET(request: Request) {
  const { ctx, error } = await requireApiHousehold();
  if (error || !ctx) return error!;

  const { searchParams } = new URL(request.url);
  const weekParam = searchParams.get("weekStart");
  const weekStart = weekParam ? new Date(weekParam) : monday();

  const menu = await prisma.weeklyMenu.findUnique({
    where: {
      householdId_weekStart: {
        householdId: ctx.household.id,
        weekStart,
      },
    },
    include: {
      meals: { orderBy: [{ dayOfWeek: "asc" }, { mealType: "asc" }] },
    },
  });

  return NextResponse.json({ menu, weekStart });
}

export async function POST(request: Request) {
  const { ctx, error } = await requireApiHousehold();
  if (error || !ctx) return error!;

  const schema = z.object({
    weekStart: z.string().optional(),
    days: z.array(z.number().int().min(0).max(6)).optional(),
    mealId: z.string().min(1).optional(),
  });
  const body = schema.safeParse(await request.json().catch(() => ({})));
  if (!body.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const weekStart = body.data.weekStart
    ? monday(new Date(body.data.weekStart))
    : monday();
  const days = body.data.days;
  const mealId = body.data.mealId;

  const prefs = await prisma.menuPreference.findMany({
    where: { userId: { in: ctx.members.map((m) => m.userId) } },
    include: { user: { select: { name: true } } },
  });

  const preferenceInputs =
    prefs.length > 0
      ? prefs.map((p) => ({
          name: p.user.name,
          allergies: p.allergies,
          dislikes: p.dislikes,
          goal: p.goal,
          mealsPerWeek: p.mealsPerWeek,
          extraNotes: p.extraNotes,
        }))
      : ctx.members.map((m) => ({
          name: m.user.name,
          allergies: [] as string[],
          dislikes: [] as string[],
          goal: "equilibrado",
          mealsPerWeek: 14,
          extraNotes: null as string | null,
        }));

  const favoriteRecipes = await prisma.recipe.findMany({
    where: { householdId: ctx.household.id },
    orderBy: { updatedAt: "desc" },
    take: 5,
    select: { name: true },
  });
  const favoriteNames = favoriteRecipes.map((r) => r.name);

  // —— Sustituir un solo plato ——
  if (mealId) {
    const existing = await prisma.meal.findFirst({
      where: {
        id: mealId,
        weeklyMenu: { householdId: ctx.household.id },
      },
      include: {
        weeklyMenu: {
          include: {
            meals: { select: { id: true, name: true } },
          },
        },
      },
    });
    if (!existing) {
      return NextResponse.json({ error: "Plato no encontrado" }, { status: 404 });
    }

    const otherMealNames = existing.weeklyMenu.meals
      .filter((m) => m.id !== existing.id)
      .map((m) => m.name);

    let generated;
    try {
      generated = await generateWeeklyMeals(preferenceInputs, undefined, favoriteNames, {
        dayOfWeek: existing.dayOfWeek,
        mealType: existing.mealType,
        avoidName: existing.name,
        otherMealNames,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Error generando plato";
      return NextResponse.json({ error: message }, { status: 502 });
    }

    const replacement = generated[0];
    if (!replacement) {
      return NextResponse.json(
        { error: "No se pudo generar el plato" },
        { status: 502 }
      );
    }

    const menu = await prisma.$transaction(async (tx) => {
      await tx.meal.delete({ where: { id: existing.id } });
      await tx.meal.create({
        data: mealRow(existing.weeklyMenuId, replacement),
      });
      return tx.weeklyMenu.findUnique({
        where: { id: existing.weeklyMenuId },
        include: {
          meals: { orderBy: [{ dayOfWeek: "asc" }, { mealType: "asc" }] },
        },
      });
    });

    const newMeal = menu?.meals.find(
      (m) =>
        m.dayOfWeek === existing.dayOfWeek && m.mealType === existing.mealType
    );

    return NextResponse.json({
      menu,
      replacedMealId: newMeal?.id ?? null,
      needsImages: true,
    });
  }

  // —— Semana o día(s) ——
  let meals;
  try {
    meals = await generateWeeklyMeals(preferenceInputs, days, favoriteNames);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error generando menú";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const menu = await prisma.$transaction(async (tx) => {
    const weekly = await tx.weeklyMenu.upsert({
      where: {
        householdId_weekStart: {
          householdId: ctx.household.id,
          weekStart,
        },
      },
      create: {
        householdId: ctx.household.id,
        weekStart,
      },
      update: {},
    });

    if (days?.length) {
      await tx.meal.deleteMany({
        where: {
          weeklyMenuId: weekly.id,
          dayOfWeek: { in: days },
        },
      });
    } else {
      await tx.meal.deleteMany({ where: { weeklyMenuId: weekly.id } });
    }

    await tx.meal.createMany({
      data: meals.map((m) => mealRow(weekly.id, m)),
    });

    return tx.weeklyMenu.findUnique({
      where: { id: weekly.id },
      include: {
        meals: { orderBy: [{ dayOfWeek: "asc" }, { mealType: "asc" }] },
      },
    });
  });

  return NextResponse.json({
    menu,
    needsImages: true,
  });
}
