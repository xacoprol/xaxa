import OpenAI from "openai";
import { z } from "zod";

const ticketItemSchema = z.object({
  name: z.string().min(1),
  quantity: z.number().positive().nullable().optional(),
  unit: z.string().nullable().optional(),
  unitPrice: z.number().nonnegative().nullable().optional(),
  lineTotal: z.number().nonnegative().nullable().optional(),
  skip: z.boolean().optional(),
  skipReason: z.string().optional(),
});

const ticketSchema = z.object({
  store: z.string().nullable().optional(),
  date: z.string().nullable().optional(),
  totalPaid: z.number().nullable().optional(),
  items: z.array(ticketItemSchema),
});

export type TicketItem = z.infer<typeof ticketItemSchema> & {
  suggestedPrice: number;
};

export type ParsedTicket = {
  store: string | null;
  date: string | null;
  totalPaid: number | null;
  items: TicketItem[];
};

function extractJson(text: string) {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fence ? fence[1].trim() : trimmed;
  return JSON.parse(raw);
}

function suggestedPrice(item: z.infer<typeof ticketItemSchema>): number | null {
  if (item.unitPrice != null && item.unitPrice > 0) {
    return Math.round(item.unitPrice * 100) / 100;
  }
  if (item.lineTotal != null && item.lineTotal > 0) {
    const qty = item.quantity && item.quantity > 0 ? item.quantity : 1;
    return Math.round((item.lineTotal / qty) * 100) / 100;
  }
  return null;
}

/** Parsea un ticket de supermercado (foto/PDF imagen) con visión. */
export async function parseSupermarketTicket(opts: {
  imageBase64: string;
  mimeType: string;
}): Promise<ParsedTicket> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Falta OPENAI_API_KEY");

  const openai = new OpenAI({ apiKey });
  const dataUrl = `data:${opts.mimeType};base64,${opts.imageBase64}`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.1,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "Extraes líneas de tickets de supermercado españoles (Eroski, etc.). Respondes solo JSON válido.",
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Analiza este ticket (factura simplificada). Extrae cada producto alimentario/bebida.

Ignora o marca skip=true: socio club, códigos, bolsas, hielo si no es comida, líneas de descuento/oferta, totales, IVA, pagos.

Para cada ítem:
- name: nombre limpio en minúsculas razonables (ej. "pechuga de pavo", "cerveza lata", "zanahoria baby")
- quantity: número de unidades o kg si aparece
- unit: "ud" | "kg" | null
- unitPrice: EUROS/UD o €/kg si aparece
- lineTotal: EUROS/TOT de la línea (antes de descuentos globales si se ve)

JSON:
{
  "store": "Eroski" | null,
  "date": "YYYY-MM-DD" | null,
  "totalPaid": number | null,
  "items": [
    {
      "name": "string",
      "quantity": number | null,
      "unit": "ud" | "kg" | null,
      "unitPrice": number | null,
      "lineTotal": number | null,
      "skip": false,
      "skipReason": null
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

  const parsed = ticketSchema.safeParse(extractJson(content));
  if (!parsed.success) {
    throw new Error("No se pudo interpretar el ticket");
  }

  const items: TicketItem[] = [];
  for (const raw of parsed.data.items) {
    if (raw.skip) continue;
    const price = suggestedPrice(raw);
    if (price == null || price <= 0) continue;
    const name = raw.name.trim();
    if (!name || name.length < 2) continue;
    items.push({ ...raw, name, suggestedPrice: price });
  }

  return {
    store: parsed.data.store ?? null,
    date: parsed.data.date ?? null,
    totalPaid: parsed.data.totalPaid ?? null,
    items,
  };
}
