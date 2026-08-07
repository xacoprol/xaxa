import OpenAI from "openai";
import { z } from "zod";
import { aggregateQuantities } from "@/lib/menus/aggregate-quantities";

const mealSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  mealType: z.enum(["COMIDA", "CENA"]),
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

function buildPrompt(
  prefs: PreferenceInput[],
  days?: number[],
  favoriteNames: string[] = []
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

  const dayFilter =
    days && days.length
      ? `Genera SOLO para los días (0=lunes…6=domingo): ${days.join(", ")}. Incluye COMIDA y CENA de cada día solicitado.`
      : `Genera la semana completa (días 0–6), COMIDA y CENA cada día (14 platos). Si mealsPerWeek medio del hogar es ${avgMeals} y es menor que 14, prioriza variedad y platos más ligeros en cenas, pero sigue devolviendo 14 entradas.`;

  const favoritesBlock =
    favoriteNames.length > 0
      ? `Inspiración (favoritos del hogar — NO copies nombres literales esta semana): ${favoriteNames
          .slice(0, 5)
          .join(", ")}.`
      : "";

  return `Eres un chef familiar mediterráneo/español. Diseña un menú semanal casero, apetitoso y realista en español.

Preferencias de los miembros:
${prefsBlock}

${dayFilter}
${favoritesBlock}

Responde ÚNICAMENTE con JSON válido (sin markdown) con esta forma:
{
  "meals": [
    {
      "dayOfWeek": 0,
      "mealType": "COMIDA" | "CENA",
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
- estimatedMins ≈ prepMins + cookMins.`;
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
  favoriteNames: string[] = []
): Promise<GeneratedMeal[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Falta OPENAI_API_KEY");
  }

  const openai = new OpenAI({ apiKey });
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.75,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "Respondes solo JSON válido según el esquema pedido. Recetas caseras detalladas en español.",
      },
      {
        role: "user",
        content: buildPrompt(prefs, days, favoriteNames),
      },
    ],
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error("Respuesta vacía de OpenAI");

  const parsed = weekSchema.safeParse(extractJson(content));
  if (!parsed.success) {
    throw new Error("No se pudo parsear el menú generado");
  }

  return parsed.data.meals.map((m) => {
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
