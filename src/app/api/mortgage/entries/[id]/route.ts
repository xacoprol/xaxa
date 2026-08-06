import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiHousehold } from "@/lib/auth";
import { z } from "zod";

type Params = { params: { id: string } };

export async function PATCH(request: Request, { params }: Params) {
  const { ctx, error } = await requireApiHousehold();
  if (error || !ctx) return error!;

  const existing = await prisma.mortgageEntry.findFirst({
    where: { id: params.id, householdId: ctx.household.id },
  });
  if (!existing) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  const schema = z.object({
    title: z.string().min(1).optional(),
    description: z.string().optional().nullable(),
    date: z.string().optional(),
    status: z.enum(["PENDIENTE", "EN_CURSO", "CERRADO"]).optional(),
  });

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const entry = await prisma.mortgageEntry.update({
    where: { id: params.id },
    data: {
      title: parsed.data.title,
      description: parsed.data.description,
      date: parsed.data.date ? new Date(parsed.data.date) : undefined,
      status: parsed.data.status,
    },
    include: { attachments: true },
  });

  return NextResponse.json({ entry });
}

export async function DELETE(_req: Request, { params }: Params) {
  const { ctx, error } = await requireApiHousehold();
  if (error || !ctx) return error!;

  const existing = await prisma.mortgageEntry.findFirst({
    where: { id: params.id, householdId: ctx.household.id },
  });
  if (!existing) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  await prisma.mortgageEntry.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
