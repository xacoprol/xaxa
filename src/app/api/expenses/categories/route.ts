import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiHousehold } from "@/lib/auth";
import { z } from "zod";

export async function GET() {
  const { ctx, error } = await requireApiHousehold();
  if (error || !ctx) return error!;

  const categories = await prisma.expenseCategory.findMany({
    where: { householdId: ctx.household.id },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ categories });
}

export async function POST(request: Request) {
  const { ctx, error } = await requireApiHousehold();
  if (error || !ctx) return error!;

  if (ctx.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Solo admins pueden crear categorías" },
      { status: 403 }
    );
  }

  const schema = z.object({
    name: z.string().min(1).max(60),
    color: z.string().optional(),
  });
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  try {
    const category = await prisma.expenseCategory.create({
      data: {
        householdId: ctx.household.id,
        name: parsed.data.name.trim(),
        color: parsed.data.color ?? "#10b981",
      },
    });
    return NextResponse.json({ category }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Ya existe una categoría con ese nombre" },
      { status: 409 }
    );
  }
}
