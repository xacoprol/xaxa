import OpenAI from "openai";
import { z } from "zod";

/** Acepta number, "1,99", null, "" → number | null */
function toNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const cleaned = value
      .trim()
      .replace(/\s/g, "")
      .replace("€", "")
      .replace(",", ".");
    if (!cleaned) return null;
    const n = Number(cleaned.replace(/[^\d.-]/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

const looseNumber = z.unknown().transform(toNumber);

const ticketItemSchema = z.object({
  name: z.unknown().transform((v) => String(v ?? "").trim()),
  quantity: looseNumber,
  unit: z
    .unknown()
    .transform((v) => {
      if (v == null || v === "") return null;
      return String(v).trim() || null;
    })
    .optional(),
  unitPrice: looseNumber,
  lineTotal: looseNumber,
  skip: z
    .unknown()
    .transform((v) => v === true || v === "true")
    .optional(),
  skipReason: z
    .unknown()
    .transform((v) => (v == null || v === "" ? undefined : String(v)))
    .optional(),
});

const ticketSchema = z.object({
  store: z
    .unknown()
    .transform((v) => (v == null || v === "" ? null : String(v)))
    .optional(),
  date: z
    .unknown()
    .transform((v) => (v == null || v === "" ? null : String(v)))
    .optional(),
  totalPaid: looseNumber.optional(),
  items: z.array(ticketItemSchema).default([]),
});

export type PriceUnit = "kg" | "l" | "ud";

export type TicketItem = {
  name: string;
  quantity: number | null;
  unit: string | null;
  unitPrice: number | null;
  lineTotal: number | null;
  skip?: boolean;
  skipReason?: string;
  /** Precio de catálogo: €/kg, €/l o €/ud */
  suggestedPrice: number;
  priceUnit: PriceUnit;
  /** Texto tipo "450 g · 5,83 € en ticket" */
  ticketNote: string | null;
};

export type ParsedTicket = {
  store: string | null;
  date: string | null;
  totalPaid: number | null;
  items: TicketItem[];
};

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fence ? fence[1].trim() : trimmed;
  try {
    return JSON.parse(raw);
  } catch {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(raw.slice(start, end + 1));
    }
    throw new Error("Respuesta JSON inválida del lector de tickets");
  }
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function normalizeUnit(unit: string | null | undefined): "kg" | "g" | "l" | "ml" | "ud" | null {
  if (!unit) return null;
  const u = unit.toLowerCase().trim().replace(/\.$/, "");
  if (["kg", "kilo", "kilos", "kilogramo", "kilogramos"].includes(u)) return "kg";
  if (["g", "gr", "grs", "gramo", "gramos"].includes(u)) return "g";
  if (["l", "lt", "litro", "litros"].includes(u)) return "l";
  if (["ml", "mililitro", "mililitros", "cl"].includes(u)) return u === "cl" ? "ml" : "ml";
  if (
    ["ud", "u", "un", "uds", "unidad", "unidades", "pieza", "piezas"].includes(u)
  ) {
    return "ud";
  }
  return null;
}

/**
 * Precio a guardar en catálogo:
 * - Al peso → €/kg
 * - Líquidos → €/l
 * - Por unidad → €/ud
 */
export function catalogPriceFromTicket(item: {
  quantity: number | null;
  unit: string | null;
  unitPrice: number | null;
  lineTotal: number | null;
}): {
  suggestedPrice: number;
  priceUnit: PriceUnit;
  ticketNote: string | null;
} | null {
  const kind = normalizeUnit(item.unit);
  const qty = item.quantity;
  const line = item.lineTotal;
  const up = item.unitPrice;

  const isWeight = kind === "kg" || kind === "g";
  const isVolume = kind === "l" || kind === "ml";

  if (isWeight) {
    let note: string | null = null;
    if (qty != null && qty > 0) {
      const qtyLabel =
        kind === "g"
          ? `${qty % 1 === 0 ? qty : round2(qty)} g`
          : `${round2(qty)} kg`;
      note =
        line != null && line > 0
          ? `${qtyLabel} · ${round2(line).toLocaleString("es-ES", {
              style: "currency",
              currency: "EUR",
            })} en ticket`
          : qtyLabel;
    }

    if (up != null && up > 0 && qty != null && qty > 0 && line != null && line > 0) {
      const kg = kind === "g" ? qty / 1000 : qty;
      const expected = up * kg;
      if (Math.abs(expected - line) <= 0.08 || Math.abs(expected - line) / line < 0.04) {
        return { suggestedPrice: round2(up), priceUnit: "kg", ticketNote: note };
      }
      if (kind === "g" && Math.abs(up * qty - line) <= 0.08) {
        return {
          suggestedPrice: round2(line / (qty / 1000)),
          priceUnit: "kg",
          ticketNote: note,
        };
      }
    }

    if (line != null && line > 0 && qty != null && qty > 0) {
      const kg = kind === "g" ? qty / 1000 : qty;
      if (kg > 0) {
        return {
          suggestedPrice: round2(line / kg),
          priceUnit: "kg",
          ticketNote: note,
        };
      }
    }

    if (up != null && up > 0) {
      if (kind === "g" && up < 0.5 && qty != null && qty > 10) {
        return {
          suggestedPrice: round2(up * 1000),
          priceUnit: "kg",
          ticketNote: note,
        };
      }
      return { suggestedPrice: round2(up), priceUnit: "kg", ticketNote: note };
    }

    return null;
  }

  if (isVolume) {
    let note: string | null = null;
    if (qty != null && qty > 0) {
      const qtyLabel =
        kind === "ml"
          ? `${qty % 1 === 0 ? qty : round2(qty)} ml`
          : `${round2(qty)} l`;
      note =
        line != null && line > 0
          ? `${qtyLabel} · ${round2(line).toLocaleString("es-ES", {
              style: "currency",
              currency: "EUR",
            })} en ticket`
          : qtyLabel;
    }

    if (up != null && up > 0 && qty != null && qty > 0 && line != null && line > 0) {
      const liters = kind === "ml" ? qty / 1000 : qty;
      const expected = up * liters;
      if (Math.abs(expected - line) <= 0.08 || Math.abs(expected - line) / line < 0.04) {
        return { suggestedPrice: round2(up), priceUnit: "l", ticketNote: note };
      }
    }

    if (line != null && line > 0 && qty != null && qty > 0) {
      const liters = kind === "ml" ? qty / 1000 : qty;
      if (liters > 0) {
        return {
          suggestedPrice: round2(line / liters),
          priceUnit: "l",
          ticketNote: note,
        };
      }
    }

    if (up != null && up > 0) {
      return { suggestedPrice: round2(up), priceUnit: "l", ticketNote: note };
    }

    return null;
  }

  // Por unidad (incluye botella 1 L sin indicar ml: se guarda €/ud)
  if (up != null && up > 0) {
    const note =
      qty != null && qty > 1 && line != null
        ? `${qty} ud · ${round2(line).toLocaleString("es-ES", {
            style: "currency",
            currency: "EUR",
          })} en ticket`
        : null;
    return { suggestedPrice: round2(up), priceUnit: "ud", ticketNote: note };
  }
  if (line != null && line > 0) {
    const q = qty != null && qty > 0 ? qty : 1;
    return {
      suggestedPrice: round2(line / q),
      priceUnit: "ud",
      ticketNote:
        q > 1
          ? `${q} ud · ${round2(line).toLocaleString("es-ES", {
              style: "currency",
              currency: "EUR",
            })} en ticket`
          : null,
    };
  }
  return null;
}

function normalizePayload(raw: unknown): unknown {
  if (Array.isArray(raw)) {
    return { store: null, date: null, totalPaid: null, items: raw };
  }
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    const items =
      obj.items ??
      obj.products ??
      obj.lineas ??
      obj.lines ??
      [];
    return { ...obj, items: Array.isArray(items) ? items : [] };
  }
  return raw;
}

/** Parsea un ticket de supermercado (foto) con visión. */
export async function parseSupermarketTicket(opts: {
  imageBase64: string;
  mimeType: string;
}): Promise<ParsedTicket> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Falta OPENAI_API_KEY");

  const mime = opts.mimeType.toLowerCase();
  if (mime.includes("heic") || mime.includes("heif")) {
    throw new Error(
      "El formato HEIC no es compatible. Guarda el ticket como JPG o PNG e inténtalo de nuevo."
    );
  }

  const openai = new OpenAI({ apiKey });
  const dataUrl = `data:${opts.mimeType};base64,${opts.imageBase64}`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "Extraes líneas de tickets de supermercado españoles (Eroski, Mercadona, Carrefour, etc.). Respondes SOLO un objeto JSON válido. Los precios van en número decimal con punto (ej. 1.99), nunca como texto.",
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Analiza esta foto de ticket / factura simplificada. Extrae cada producto alimentario o bebida.

Ignora o marca skip=true: socio club, códigos de barras sueltos, bolsas de plástico, hielo si no es comida, líneas de descuento/oferta, subtotales, totales, IVA, forma de pago, puntos.

Reglas de precios (imprescindible):
- unitPrice y lineTotal deben ser NÚMEROS (no strings). Usa punto decimal.
- Productos AL PESO (fiambre, carne, fruta a granel…):
  - quantity = peso (en kg si puedes; si el ticket pone 450 g, quantity=450 y unit="g", o quantity=0.45 y unit="kg")
  - unitPrice = precio €/kg si aparece en el ticket (columna €/UD o €/kg)
  - lineTotal = importe de la línea (€/TOT), ej. 5.83
  - Ejemplo: pechuga de pavo 450 g, 12,96 €/kg, total 5,83 → quantity=450, unit="g", unitPrice=12.96, lineTotal=5.83
- Productos POR UNIDAD:
  - unit="ud", unitPrice=€/unidad, lineTotal=total de la línea
- Si solo hay un importe por línea, ponlo en lineTotal.

JSON exacto:
{
  "store": "Eroski",
  "date": "YYYY-MM-DD",
  "totalPaid": 45.67,
  "items": [
    {
      "name": "pechuga de pavo",
      "quantity": 450,
      "unit": "g",
      "unitPrice": 12.96,
      "lineTotal": 5.83,
      "skip": false
    },
    {
      "name": "leche entera",
      "quantity": 1,
      "unit": "ud",
      "unitPrice": 1.05,
      "lineTotal": 1.05,
      "skip": false
    }
  ]
}`,
          },
          {
            type: "image_url",
            image_url: { url: dataUrl, detail: "high" },
          },
        ],
      },
    ],
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error("Respuesta vacía al leer el ticket");

  let raw: unknown;
  try {
    raw = normalizePayload(extractJson(content));
  } catch {
    throw new Error("No se pudo interpretar el ticket (JSON inválido)");
  }

  const parsed = ticketSchema.safeParse(raw);
  if (!parsed.success) {
    console.error(
      "[parse-ticket] schema",
      parsed.error.flatten(),
      content.slice(0, 500)
    );
    throw new Error("No se pudo interpretar el ticket");
  }

  const items: TicketItem[] = [];
  for (const row of parsed.data.items) {
    if (row.skip) continue;
    const catalog = catalogPriceFromTicket({
      quantity: row.quantity,
      unit: row.unit ?? null,
      unitPrice: row.unitPrice,
      lineTotal: row.lineTotal,
    });
    if (!catalog) continue;
    if (catalog.suggestedPrice <= 0 || catalog.suggestedPrice > 500) continue;
    const name = row.name.trim();
    if (!name || name.length < 2) continue;
    items.push({
      name,
      quantity: row.quantity,
      unit: row.unit ?? null,
      unitPrice: row.unitPrice,
      lineTotal: row.lineTotal,
      skip: row.skip,
      skipReason: row.skipReason,
      suggestedPrice: catalog.suggestedPrice,
      priceUnit: catalog.priceUnit,
      ticketNote: catalog.ticketNote,
    });
  }

  return {
    store: parsed.data.store ?? null,
    date: parsed.data.date ?? null,
    totalPaid: parsed.data.totalPaid ?? null,
    items,
  };
}
