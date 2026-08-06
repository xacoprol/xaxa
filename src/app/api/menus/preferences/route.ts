import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiHousehold } from "@/lib/auth";
import { z } from "zod";

export async function GET() {
  const { ctx, error } = await requireApiHousehold();
  if (error || !ctx) return error!;

  const preference = await prisma.menuPreference.findUnique({
    where: { userId: ctx.user.id },
  });

  return NextResponse.json({ preference });
}

export async function PUT(request: Request) {
  const { ctx, error } = await requireApiHousehold();
  if (error || !ctx) return error!;

  const schema = z.object({
    allergies: z.array(z.string()).default([]),
    dislikes: z.array(z.string()).default([]),
    goal: z.string().optional().nullable(),
    mealsPerWeek: z.number().int().min(1).max(21).default(14),
    extraNotes: z.string().optional().nullable(),
  });

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const preference = await prisma.menuPreference.upsert({
    where: { userId: ctx.user.id },
    create: {
      userId: ctx.user.id,
      ...parsed.data,
      goal: parsed.data.goal ?? null,
      extraNotes: parsed.data.extraNotes ?? null,
    },
    update: {
      ...parsed.data,
      goal: parsed.data.goal ?? null,
      extraNotes: parsed.data.extraNotes ?? null,
    },
  });

  return NextResponse.json({ preference });
}
