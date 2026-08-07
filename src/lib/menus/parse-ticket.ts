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

export type TicketItem = {
  name: string;
  quantity: number | null;
  unit: string | null;
  unitPrice: number | null;
  lineTotal: number | null;
  skip?: boolean;
  skipReason?: string;
  suggestedPrice: number;
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
  // A veces el modelo envuelve el array sin objeto
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

function suggestedPrice(item: {
  quantity: number | null;
  unitPrice: number | null;
  lineTotal: number | null;
}): number | null {
  if (item.unitPrice != null && item.unitPrice > 0) {
    return Math.round(item.unitPrice * 100) / 100;
  }
  if (item.lineTotal != null && item.lineTotal > 0) {
    const qty =
      item.quantity != null && item.quantity > 0 ? item.quantity : 1;
    return Math.round((item.lineTotal / qty) * 100) / 100;
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
- Si el ticket muestra €/UD y €/TOT, rellena unitPrice y lineTotal.
- Si solo hay un importe por línea, ponlo en lineTotal y unitPrice=null.
- quantity: número de unidades o kg si se ve; si no, null.

JSON exacto:
{
  "store": "Eroski",
  "date": "YYYY-MM-DD",
  "totalPaid": 45.67,
  "items": [
    {
      "name": "pechuga de pavo",
      "quantity": 1,
      "unit": "ud",
      "unitPrice": 2.45,
      "lineTotal": 2.45,
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
    console.error("[parse-ticket] schema", parsed.error.flatten(), content.slice(0, 500));
    throw new Error("No se pudo interpretar el ticket");
  }

  const items: TicketItem[] = [];
  for (const row of parsed.data.items) {
    if (row.skip) continue;
    const price = suggestedPrice(row);
    if (price == null || price <= 0 || price > 500) continue;
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
      suggestedPrice: price,
    });
  }

  return {
    store: parsed.data.store ?? null,
    date: parsed.data.date ?? null,
    totalPaid: parsed.data.totalPaid ?? null,
    items,
  };
}
