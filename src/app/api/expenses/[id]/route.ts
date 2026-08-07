import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiHousehold } from "@/lib/auth";
import { z } from "zod";

const splitSchema = z.object({
  userId: z.string().uuid(),
  percent: z.number().min(0).max(100),
});

const updateSchema = z.object({
  title: z.string().trim().min(1).optional(),
  amount: z.number().positive().optional(),
  categoryId: z.string().min(1).optional(),
  date: z.string().min(1).optional(),
  note: z.string().optional().nullable(),
  type: z.enum(["SHARED", "INDIVIDUAL"]).optional(),
  paidById: z.string().uuid().optional(),
  splits: z.array(splitSchema).optional(),
});

type Params = { params: { id: string } };

export async function GET(_req: Request, { params }: Params) {
  const { ctx, error } = await requireApiHousehold();
  if (error || !ctx) return error!;

  const expense = await prisma.expense.findFirst({
    where: { id: params.id, householdId: ctx.household.id },
    include: {
      category: true,
      paidBy: { select: { id: true, name: true } },
      splits: { include: { user: { select: { id: true, name: true } } } },
    },
  });

  if (!expense) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  return NextResponse.json({ expense });
}

export async function PATCH(request: Request, { params }: Params) {
  const { ctx, error } = await requireApiHousehold();
  if (error || !ctx) return error!;

  const existing = await prisma.expense.findFirst({
    where: { id: params.id, householdId: ctx.household.id },
  });
  if (!existing) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const type = data.type ?? existing.type;

  if (type === "SHARED" && data.splits?.length) {
    const total = data.splits.reduce((s, x) => s + x.percent, 0);
    if (Math.abs(total - 100) > 0.05) {
      return NextResponse.json(
        { error: "Los porcentajes deben sumar 100%" },
        { status: 400 }
      );
    }
  }

  const expense = await prisma.$transaction(async (tx) => {
    if (data.splits) {
      await tx.expenseSplit.deleteMany({ where: { expenseId: params.id } });
    }

    return tx.expense.update({
      where: { id: params.id },
      data: {
        title: data.title,
        amount: data.amount,
        categoryId: data.categoryId,
        date: data.date ? new Date(data.date) : undefined,
        note: data.note === undefined ? undefined : data.note,
        type: data.type,
        paidById: data.paidById,
        splits:
          type === "SHARED" && data.splits
            ? {
                create: data.splits.map((s) => ({
                  userId: s.userId,
                  percent: s.percent,
                })),
              }
            : undefined,
      },
      include: {
        category: true,
        paidBy: { select: { id: true, name: true } },
        splits: true,
      },
    });
  });

  return NextResponse.json({ expense });
}

export async function DELETE(_req: Request, { params }: Params) {
  const { ctx, error } = await requireApiHousehold();
  if (error || !ctx) return error!;

  const existing = await prisma.expense.findFirst({
    where: { id: params.id, householdId: ctx.household.id },
  });
  if (!existing) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  await prisma.expense.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
