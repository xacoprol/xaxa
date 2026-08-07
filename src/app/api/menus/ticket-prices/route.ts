import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireApiHousehold } from "@/lib/auth";
import { normalizeIngredientKey } from "@/lib/menus/default-prices";
import { parseSupermarketTicket } from "@/lib/menus/parse-ticket";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ALLOWED = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

/** POST multipart: file=imagen del ticket → extrae precios */
export async function POST(request: Request) {
  const { ctx, error } = await requireApiHousehold();
  if (error || !ctx) return error!;

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Falta la foto del ticket" }, { status: 400 });
  }

  if (file.size > 8 * 1024 * 1024) {
    return NextResponse.json({ error: "Máximo 8 MB" }, { status: 400 });
  }

  const mime = file.type || "image/jpeg";
  if (!ALLOWED.has(mime) && !mime.startsWith("image/")) {
    return NextResponse.json(
      { error: "Sube una foto del ticket (JPG/PNG/WebP)" },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const imageBase64 = buffer.toString("base64");

  try {
    const ticket = await parseSupermarketTicket({
      imageBase64,
      mimeType: mime.startsWith("image/") ? mime : "image/jpeg",
    });
    return NextResponse.json({ ticket });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error al leer el ticket";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

/** PUT: guardar precios seleccionados del ticket */
export async function PUT(request: Request) {
  const { ctx, error } = await requireApiHousehold();
  if (error || !ctx) return error!;

  const schema = z.object({
    items: z
      .array(
        z.object({
          name: z.string().min(1),
          unitPrice: z.number().min(0).max(9999),
          priceUnit: z.enum(["kg", "l", "ud"]).optional(),
        })
      )
      .min(1)
      .max(80),
  });

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const saved = [];
  for (const item of parsed.data.items) {
    const nameKey = normalizeIngredientKey(item.name);
    const priceUnit = item.priceUnit ?? "ud";
    const row = await prisma.ingredientPrice.upsert({
      where: {
        householdId_nameKey: {
          householdId: ctx.household.id,
          nameKey,
        },
      },
      create: {
        householdId: ctx.household.id,
        nameKey,
        name: item.name.trim(),
        unitPrice: item.unitPrice,
        priceUnit,
      },
      update: {
        name: item.name.trim(),
        unitPrice: item.unitPrice,
        priceUnit,
      },
    });
    saved.push({
      name: row.name,
      nameKey: row.nameKey,
      unitPrice: Number(row.unitPrice),
      priceUnit: row.priceUnit,
    });
  }

  return NextResponse.json({ saved, count: saved.length });
}
