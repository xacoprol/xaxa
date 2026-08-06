import { NextResponse } from "next/server";
import { startOfWeek } from "date-fns";
import { prisma } from "@/lib/prisma";
import { requireApiHousehold } from "@/lib/auth";
import { generateWeeklyMeals } from "@/lib/menus/openai";
import { z } from "zod";

function monday(date = new Date()) {
  return startOfWeek(date, { weekStartsOn: 1 });
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
  });
  const body = schema.safeParse(await request.json().catch(() => ({})));
  if (!body.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const weekStart = body.data.weekStart
    ? monday(new Date(body.data.weekStart))
    : monday();
  const days = body.data.days;

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

  let meals;
  try {
    meals = await generateWeeklyMeals(preferenceInputs, days);
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
      data: meals.map((m) => ({
        weeklyMenuId: weekly.id,
        dayOfWeek: m.dayOfWeek,
        mealType: m.mealType,
        name: m.name,
        ingredients: m.ingredients,
        steps: m.steps,
        estimatedMins: m.estimatedMins ?? null,
      })),
    });

    return tx.weeklyMenu.findUnique({
      where: { id: weekly.id },
      include: {
        meals: { orderBy: [{ dayOfWeek: "asc" }, { mealType: "asc" }] },
      },
    });
  });

  return NextResponse.json({ menu });
}
