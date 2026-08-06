import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiHousehold } from "@/lib/auth";
import { z } from "zod";

export async function GET() {
  const { ctx, error } = await requireApiHousehold();
  if (error || !ctx) return error!;

  const [mortgage, entries] = await Promise.all([
    prisma.mortgage.findUnique({ where: { householdId: ctx.household.id } }),
    prisma.mortgageEntry.findMany({
      where: { householdId: ctx.household.id },
      include: { attachments: true, createdBy: { select: { name: true } } },
      orderBy: { date: "desc" },
    }),
  ]);

  return NextResponse.json({ mortgage, entries });
}

export async function POST(request: Request) {
  const { ctx, error } = await requireApiHousehold();
  if (error || !ctx) return error!;

  const schema = z.object({
    title: z.string().min(1),
    description: z.string().optional().nullable(),
    date: z.string().min(1),
    status: z.enum(["PENDIENTE", "EN_CURSO", "CERRADO"]).default("PENDIENTE"),
  });

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const entry = await prisma.mortgageEntry.create({
    data: {
      householdId: ctx.household.id,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      date: new Date(parsed.data.date),
      status: parsed.data.status,
      createdById: ctx.user.id,
    },
    include: { attachments: true },
  });

  return NextResponse.json({ entry }, { status: 201 });
}

export async function PUT(request: Request) {
  const { ctx, error } = await requireApiHousehold();
  if (error || !ctx) return error!;

  const schema = z.object({
    amount: z.number().positive().optional().nullable(),
    termYears: z.number().int().positive().optional().nullable(),
    interestRate: z.number().positive().optional().nullable(),
    bank: z.string().optional().nullable(),
    signedAt: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
  });

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const mortgage = await prisma.mortgage.upsert({
    where: { householdId: ctx.household.id },
    create: {
      householdId: ctx.household.id,
      amount: parsed.data.amount ?? null,
      termYears: parsed.data.termYears ?? null,
      interestRate: parsed.data.interestRate ?? null,
      bank: parsed.data.bank ?? null,
      signedAt: parsed.data.signedAt
        ? new Date(parsed.data.signedAt)
        : null,
      notes: parsed.data.notes ?? null,
    },
    update: {
      amount: parsed.data.amount,
      termYears: parsed.data.termYears,
      interestRate: parsed.data.interestRate,
      bank: parsed.data.bank,
      signedAt:
        parsed.data.signedAt === undefined
          ? undefined
          : parsed.data.signedAt
            ? new Date(parsed.data.signedAt)
            : null,
      notes: parsed.data.notes,
    },
  });

  return NextResponse.json({ mortgage });
}
