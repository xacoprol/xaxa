import { startOfWeek } from "date-fns";
import { requireHousehold } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MenusView } from "@/components/menus/menus-view";

export default async function MenusPage() {
  const { household, user } = await requireHousehold();
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });

  const [menu, preference] = await Promise.all([
    prisma.weeklyMenu.findUnique({
      where: {
        householdId_weekStart: {
          householdId: household.id,
          weekStart,
        },
      },
      include: {
        meals: {
          orderBy: [{ dayOfWeek: "asc" }, { mealType: "asc" }],
          // Lista ligera: detalle (ingredientes/pasos) se carga al abrir
          select: {
            id: true,
            dayOfWeek: true,
            mealType: true,
            name: true,
            description: true,
            servings: true,
            difficulty: true,
            tags: true,
            imageUrl: true,
            prepMins: true,
            cookMins: true,
            estimatedMins: true,
            isFavorite: true,
          },
        },
      },
    }),
    prisma.menuPreference.findUnique({
      where: { userId: user.id },
      select: {
        allergies: true,
        dislikes: true,
        goal: true,
        mealsPerWeek: true,
        extraNotes: true,
      },
    }),
  ]);

  return (
    <MenusView
      weekStartIso={weekStart.toISOString()}
      preferenceInitial={
        preference
          ? {
              allergies: preference.allergies,
              dislikes: preference.dislikes,
              goal: preference.goal,
              mealsPerWeek: preference.mealsPerWeek,
              extraNotes: preference.extraNotes,
            }
          : null
      }
      meals={(menu?.meals ?? []).map((m) => ({
        id: m.id,
        dayOfWeek: m.dayOfWeek,
        mealType: m.mealType,
        name: m.name,
        description: m.description,
        ingredients: [],
        steps: [],
        servings: m.servings,
        difficulty: m.difficulty,
        tags: m.tags,
        imageUrl: m.imageUrl,
        prepMins: m.prepMins,
        cookMins: m.cookMins,
        estimatedMins: m.estimatedMins,
        isFavorite: m.isFavorite,
        detailLoaded: false,
      }))}
    />
  );
}
