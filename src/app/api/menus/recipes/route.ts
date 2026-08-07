import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiHousehold } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const { ctx, error } = await requireApiHousehold();
  if (error || !ctx) return error!;

  const recipes = await prisma.recipe.findMany({
    where: { householdId: ctx.household.id },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({ recipes });
}

export async function DELETE(request: Request) {
  const { ctx, error } = await requireApiHousehold();
  if (error || !ctx) return error!;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Falta id" }, { status: 400 });
  }

  const existing = await prisma.recipe.findFirst({
    where: { id, householdId: ctx.household.id },
  });
  if (!existing) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  await prisma.recipe.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
