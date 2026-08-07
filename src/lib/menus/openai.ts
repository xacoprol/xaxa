import OpenAI from "openai";
import { z } from "zod";
import { aggregateQuantities } from "@/lib/menus/aggregate-quantities";

const mealSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  mealType: z.enum(["DESAYUNO", "COMIDA", "CENA"]),
  name: z.string().min(2),
  description: z.string().optional(),
  ingredients: z.array(
    z.union([
      z.string(),
      z.object({
        name: z.string(),
        quantity: z.union([z.string(), z.number()]).optional(),
        unit: z.string().optional(),
      }),
    ])
  ),
  steps: z.array(z.string()).min(3),
  servings: z.number().int().positive().optional(),
  difficulty: z.enum(["FACIL", "MEDIA", "ELABORADA"]).optional(),
  tags: z.array(z.string()).optional(),
  prepMins: z.number().int().positive().optional(),
  cookMins: z.number().int().positive().optional(),
  estimatedMins: z.number().int().positive().optional(),
});

const weekSchema = z.object({
  meals: z.array(mealSchema),
});

export type GeneratedMeal = z.infer<typeof mealSchema>;

export type PreferenceInput = {
  name: string;
  allergies: string[];
  dislikes: string[];
  goal: string | null;
  mealsPerWeek: number;
  extraNotes: string | null;
};

function resolveMealPlan(avgMeals: number): {
  types: Array<"DESAYUNO" | "COMIDA" | "CENA">;
  dayFilterText: (days?: number[]) => string;
} {
  // 21 → 3 al día (desayuno + comida + cena)
  if (avgMeals >= 18) {
    const types = ["DESAYUNO", "COMIDA", "CENA"] as const;
    return {
      types: [...types],
      dayFilterText: (days) =>
        days?.length
          ? `Genera SOLO para los días (0=lunes…6=domingo): ${days.join(", ")}. Incluye DESAYUNO, COMIDA y CENA de cada día (${days.length * 3} platos).`
          : "Genera la semana completa (días 0–6) con DESAYUNO, COMIDA y CENA cada día (21 platos).",
    };
  }

  // 10 → comida + cena en laborables (lun–vie)
  if (avgMeals <= 11) {
    const types = ["COMIDA", "CENA"] as const;
    return {
      types: [...types],
      dayFilterText: (days) => {
        const target = days?.length
          ? days.filter((d) => d >= 0 && d <= 4)
          : [0, 1, 2, 3, 4];
        const list = (target.length ? target : [0, 1, 2, 3, 4]).join(", ");
        return `Genera SOLO para días laborables (0=lunes…4=viernes): ${list}. Incluye COMIDA y CENA de cada día (${(target.length || 5) * 2} platos). NO generes sábado ni domingo.`;
      },
    };
  }

  // 14 → comida + cena toda la semana
  const types = ["COMIDA", "CENA"] as const;
  return {
    types: [...types],
    dayFilterText: (days) =>
      days?.length
        ? `Genera SOLO para los días (0=lunes…6=domingo): ${days.join(", ")}. Incluye COMIDA y CENA de cada día (${days.length * 2} platos).`
        : "Genera la semana completa (días 0–6), COMIDA y CENA cada día (14 platos).",
  };
}

export type MealSlotReplace = {
  dayOfWeek: number;
  mealType: "DESAYUNO" | "COMIDA" | "CENA";
  avoidName?: string;
  otherMealNames?: string[];
};

function buildPrompt(
  prefs: PreferenceInput[],
  days?: number[],
  favoriteNames: string[] = [],
  replace?: MealSlotReplace
) {
  const prefsBlock = prefs
    .map(
      (p) =>
        `- ${p.name}: alergias=[${p.allergies.join(", ") || "ninguna"}], no gusta=[${
          p.dislikes.join(", ") || "—"
        }], objetivo=${p.goal || "equilibrado"}, comidas/semana≈${p.mealsPerWeek}, notas=${p.extraNotes || "—"}`
    )
    .join("\n");

  const avgMeals =
    prefs.length > 0
      ? Math.round(
          prefs.reduce((s, p) => s + p.mealsPerWeek, 0) / prefs.length
        )
      : 14;

  const plan = resolveMealPlan(avgMeals);
  const mealTypeUnion = plan.types.map((t) => `"${t}"`).join(" | ");

  const favoritesBlock =
    favoriteNames.length > 0
      ? `Inspiración (favoritos del hogar — NO copies nombres literales esta semana): ${favoriteNames
          .slice(0, 5)
          .join(", ")}.`
      : "";

  const dayFilter = replace
    ? `Genera EXACTAMENTE 1 plato: dayOfWeek=${replace.dayOfWeek} (0=lunes…6=domingo), mealType="${replace.mealType}". Nada más.`
    : plan.dayFilterText(days);

  const avoidBlock = replace
    ? [
        replace.avoidName
          ? `NO generes el plato «${replace.avoidName}» ni una variante casi idéntica; propón algo claramente distinto.`
          : "",
        replace.otherMealNames?.length
          ? `No repitas estos platos ya previstos en la semana: ${replace.otherMealNames.join(", ")}.`
          : "",
      ]
        .filter(Boolean)
        .join("\n")
    : "";

  return `Eres un chef familiar mediterráneo/español. Diseña un menú semanal casero, apetitoso y realista en español.

Preferencias de los miembros:
${prefsBlock}

${dayFilter}
${favoritesBlock}
${avoidBlock}

Responde ÚNICAMENTE con JSON válido (sin markdown) con esta forma:
{
  "meals": [
    {
      "dayOfWeek": 0,
      "mealType": ${mealTypeUnion},
      "name": "nombre del plato",
      "description": "2–3 frases apetitosas sobre el plato y por qué encaja en casa",
      "ingredients": [{ "name": "ingrediente", "quantity": "200", "unit": "g" }],
      "steps": ["paso concreto 1", "paso 2", "..."],
      "servings": 2,
      "difficulty": "FACIL" | "MEDIA" | "ELABORADA",
      "tags": ["mediterráneo", "horno"],
      "prepMins": 15,
      "cookMins": 25,
      "estimatedMins": 40
    }
  ]
}

Reglas estrictas:
- Evita alergias y alimentos que no gustan.
- Platos caseros con ingredientes fáciles de encontrar en España.
- Cantidades claras por ingrediente.
- Pasos concretos y accionables (4–8), no vaguedades.
- Descripción apetitosa (no marketing vacío).
- Raciones por defecto 2.
- Variedad a lo largo de la semana (no repetir el mismo plato).
- estimatedMins ≈ prepMins + cookMins.
- DESAYUNO (si aplica): práctico y rápido (≤20 min), apto para mañana.
- Solo usa estos mealType: ${plan.types.join(", ")}.
${replace ? `- El array "meals" debe tener exactamente 1 elemento con dayOfWeek=${replace.dayOfWeek} y mealType="${replace.mealType}".` : ""}`;
}

function extractJson(text: string) {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fence ? fence[1].trim() : trimmed;
  return JSON.parse(raw);
}

export async function generateWeeklyMeals(
  prefs: PreferenceInput[],
  days?: number[],
  favoriteNames: string[] = [],
  replace?: MealSlotReplace
): Promise<GeneratedMeal[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Falta OPENAI_API_KEY");
  }

  const openai = new OpenAI({ apiKey });
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.85,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "Respondes solo JSON válido según el esquema pedido. Recetas caseras detalladas en español.",
      },
      {
        role: "user",
        content: buildPrompt(prefs, days, favoriteNames, replace),
      },
    ],
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error("Respuesta vacía de OpenAI");

  const parsed = weekSchema.safeParse(extractJson(content));
  if (!parsed.success) {
    throw new Error("No se pudo parsear el menú generado");
  }

  let meals = parsed.data.meals.map((m) => {
    const prep = m.prepMins ?? null;
    const cook = m.cookMins ?? null;
    const estimated =
      m.estimatedMins ??
      (prep != null || cook != null ? (prep ?? 0) + (cook ?? 0) : undefined);
    return {
      ...m,
      servings: m.servings ?? 2,
      difficulty: m.difficulty ?? "MEDIA",
      tags: m.tags ?? [],
      description: m.description,
      estimatedMins: estimated,
    };
  });

  if (replace) {
    const hit =
      meals.find(
        (m) =>
          m.dayOfWeek === replace.dayOfWeek && m.mealType === replace.mealType
      ) ?? meals[0];
    if (!hit) throw new Error("No se generó el plato sustituto");
    meals = [
      {
        ...hit,
        dayOfWeek: replace.dayOfWeek,
        mealType: replace.mealType,
      },
    ];
  }

  return meals;
}

export type ShoppingItem = {
  name: string;
  quantities: string[];
  /** Summed display, e.g. "400 g" or "0.4 kg" */
  totalQty: string | null;
  count: number;
};

export function buildShoppingList(
  ingredientsLists: unknown[]
): ShoppingItem[] {
  const map = new Map<string, ShoppingItem>();

  for (const list of ingredientsLists) {
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      let name: string;
      let qty: string | null = null;

      if (typeof item === "string") {
        name = item.trim();
      } else if (item && typeof item === "object" && "name" in item) {
        const obj = item as {
          name: string;
          quantity?: string | number;
          unit?: string;
        };
        name = String(obj.name).trim();
        if (obj.quantity != null) {
          qty = `${obj.quantity}${obj.unit ? ` ${obj.unit}` : ""}`.trim();
        }
      } else {
        continue;
      }

      if (!name) continue;
      const key = name.toLowerCase();
      const existing = map.get(key);
      if (existing) {
        existing.count += 1;
        if (qty) existing.quantities.push(qty);
      } else {
        map.set(key, {
          name,
          quantities: qty ? [qty] : [],
          totalQty: null,
          count: 1,
        });
      }
    }
  }

  return Array.from(map.values())
    .map((item) => ({
      ...item,
      totalQty: aggregateQuantities(item.quantities),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
}
