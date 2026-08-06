import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiHousehold } from "@/lib/auth";
import { z } from "zod";

const splitSchema = z.object({
  userId: z.string().uuid(),
  percent: z.number().min(0).max(100),
});

const expenseSchema = z.object({
  amount: z.number().positive(),
  categoryId: z.string().min(1),
  date: z.string().min(1),
  note: z.string().optional().nullable(),
  type: z.enum(["SHARED", "INDIVIDUAL"]),
  paidById: z.string().uuid(),
  splits: z.array(splitSchema).optional(),
});

export async function GET(request: Request) {
  const { ctx, error } = await requireApiHousehold();
  if (error || !ctx) return error!;

  const { searchParams } = new URL(request.url);
  const year = Number(searchParams.get("year") ?? new Date().getFullYear());
  const month = Number(searchParams.get("month") ?? new Date().getMonth() + 1);

  const from = new Date(year, month - 1, 1);
  const to = new Date(year, month, 0);

  const expenses = await prisma.expense.findMany({
    where: {
      householdId: ctx.household.id,
      date: { gte: from, lte: to },
    },
    include: {
      category: true,
      paidBy: { select: { id: true, name: true } },
      splits: { include: { user: { select: { id: true, name: true } } } },
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });

  return NextResponse.json({ expenses });
}

export async function POST(request: Request) {
  const { ctx, error } = await requireApiHousehold();
  if (error || !ctx) return error!;

  const parsed = expenseSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;

  if (data.type === "SHARED" && data.splits?.length) {
    const total = data.splits.reduce((s, x) => s + x.percent, 0);
    if (Math.abs(total - 100) > 0.05) {
      return NextResponse.json(
        { error: "Los porcentajes deben sumar 100%" },
        { status: 400 }
      );
    }
  }

  const memberIds = new Set(ctx.members.map((m) => m.userId));
  if (!memberIds.has(data.paidById)) {
    return NextResponse.json(
      { error: "Quién pagó no pertenece al hogar" },
      { status: 400 }
    );
  }

  const category = await prisma.expenseCategory.findFirst({
    where: { id: data.categoryId, householdId: ctx.household.id },
  });
  if (!category) {
    return NextResponse.json(
      { error: "Categoría no válida" },
      { status: 400 }
    );
  }

  const expense = await prisma.expense.create({
    data: {
      householdId: ctx.household.id,
      amount: data.amount,
      categoryId: data.categoryId,
      date: new Date(data.date),
      note: data.note || null,
      type: data.type,
      paidById: data.paidById,
      splits:
        data.type === "SHARED" && data.splits?.length
          ? {
              create: data.splits.map((s) => ({
                userId: s.userId,
                percent: s.percent,
              })),
            }
          : data.type === "SHARED"
            ? {
                create: (() => {
                  const n = ctx.members.length;
                  const base = Math.floor(10000 / n) / 100;
                  const splits = ctx.members.map((m) => ({
                    userId: m.userId,
                    percent: base,
                  }));
                  const diff =
                    100 - splits.reduce((s, x) => s + x.percent, 0);
                  if (splits[0]) {
                    splits[0].percent =
                      Math.round((splits[0].percent + diff) * 100) / 100;
                  }
                  return splits;
                })(),
              }
            : undefined,
    },
    include: {
      category: true,
      paidBy: { select: { id: true, name: true } },
      splits: true,
    },
  });

  return NextResponse.json({ expense }, { status: 201 });
}
