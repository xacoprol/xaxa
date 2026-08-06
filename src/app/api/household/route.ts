import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/auth";
import { DEFAULT_CATEGORIES } from "@/lib/constants";
import { getAppConfig, MAX_USERS_WHEN_LIMITED } from "@/lib/app-config";

export async function POST(request: Request) {
  const { user, error } = await requireApiUser();
  if (error || !user) return error!;
  const body = await request.json();

  const existing = await prisma.householdMember.findFirst({
    where: { userId: user.id },
  });
  if (existing) {
    return NextResponse.json(
      { error: "Ya perteneces a un hogar" },
      { status: 400 }
    );
  }

  if (body.action === "create") {
    const name = (body.name as string)?.trim();
    if (!name) {
      return NextResponse.json(
        { error: "El nombre es obligatorio" },
        { status: 400 }
      );
    }

    const household = await prisma.household.create({
      data: {
        name,
        members: {
          create: {
            userId: user.id,
            role: "ADMIN",
          },
        },
        categories: {
          create: DEFAULT_CATEGORIES.map((c) => ({
            name: c.name,
            color: c.color,
          })),
        },
        mortgage: {
          create: {},
        },
      },
    });

    return NextResponse.json({ household });
  }

  if (body.action === "join") {
    const inviteCode = (body.inviteCode as string)?.trim();
    if (!inviteCode) {
      return NextResponse.json(
        { error: "El código es obligatorio" },
        { status: 400 }
      );
    }

    const household = await prisma.household.findUnique({
      where: { inviteCode },
      include: { _count: { select: { members: true } } },
    });
    if (!household) {
      return NextResponse.json(
        { error: "Código de invitación no válido" },
        { status: 404 }
      );
    }

    const config = await getAppConfig();
    if (
      config.limitTwoUsers &&
      household._count.members >= MAX_USERS_WHEN_LIMITED
    ) {
      return NextResponse.json(
        {
          error: `Este hogar ya tiene ${MAX_USERS_WHEN_LIMITED} miembros y el límite está activo.`,
        },
        { status: 403 }
      );
    }

    await prisma.householdMember.create({
      data: {
        householdId: household.id,
        userId: user.id,
        role: "MEMBER",
      },
    });

    return NextResponse.json({ household });
  }

  return NextResponse.json({ error: "Acción no válida" }, { status: 400 });
}
