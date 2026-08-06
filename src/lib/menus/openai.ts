import OpenAI from "openai";
import { z } from "zod";

const mealSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  mealType: z.enum(["COMIDA", "CENA"]),
  name: z.string(),
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
  steps: z.array(z.string()),
  estimatedMins: z.number().int().positive().optional(),
});

const weekSchema = z.object({
  meals: z.array(mealSchema),
});

export type GeneratedMeal = z.infer<typeof mealSchema>;

type PreferenceInput = {
  name: string;
  allergies: string[];
  dislikes: string[];
  goal: string | null;
  mealsPerWeek: number;
  extraNotes: string | null;
};

function buildPrompt(prefs: PreferenceInput[], days?: number[]) {
  const prefsBlock = prefs
    .map(
      (p) =>
        `- ${p.name}: alergias=[${p.allergies.join(", ") || "ninguna"}], no gusta=[${
          p.dislikes.join(", ") || "—"
        }], objetivo=${p.goal || "equilibrado"}, notas=${p.extraNotes || "—"}`
    )
    .join("\n");

  const dayFilter =
    days && days.length
      ? `Genera SOLO para los días (0=lunes…6=domingo): ${days.join(", ")}. Incluye COMIDA y CENA de cada día solicitado.`
      : "Genera la semana completa (días 0–6), COMIDA y CENA cada día (14 platos).";

  return `Eres un chef familiar. Diseña un menú semanal en español para un hogar.

Preferencias de los miembros:
${prefsBlock}

${dayFilter}

Responde ÚNICAMENTE con JSON válido (sin markdown) con esta forma:
{
  "meals": [
    {
      "dayOfWeek": 0,
      "mealType": "COMIDA" | "CENA",
      "name": "nombre del plato",
      "ingredients": [{ "name": "ingrediente", "quantity": "200", "unit": "g" }],
      "steps": ["paso 1", "paso 2"],
      "estimatedMins": 30
    }
  ]
}

Reglas: evita alergias y alimentos que no gustan; platos caseros realistas; ingredientes con cantidades; pasos breves (3–6).`;
}

function extractJson(text: string) {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fence ? fence[1].trim() : trimmed;
  return JSON.parse(raw);
}

export async function generateWeeklyMeals(
  prefs: PreferenceInput[],
  days?: number[]
): Promise<GeneratedMeal[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Falta OPENAI_API_KEY");
  }

  const openai = new OpenAI({ apiKey });
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.7,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: "Respondes solo JSON válido según el esquema pedido.",
      },
      { role: "user", content: buildPrompt(prefs, days) },
    ],
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error("Respuesta vacía de OpenAI");

  const parsed = weekSchema.safeParse(extractJson(content));
  if (!parsed.success) {
    throw new Error("No se pudo parsear el menú generado");
  }

  return parsed.data.meals;
}

export type ShoppingItem = {
  name: string;
  quantities: string[];
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
          count: 1,
        });
      }
    }
  }

  return Array.from(map.values()).sort((a, b) =>
    a.name.localeCompare(b.name, "es")
  );
}
