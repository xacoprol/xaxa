import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiHousehold } from "@/lib/auth";
import { getAppConfig, MAX_USERS_WHEN_LIMITED } from "@/lib/app-config";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const { ctx, error } = await requireApiHousehold();
  if (error || !ctx) return error!;

  const config = await getAppConfig();
  const userCount = await prisma.user.count();

  return NextResponse.json({
    limitTwoUsers: config.limitTwoUsers,
    userCount,
    maxUsers: MAX_USERS_WHEN_LIMITED,
    inviteCode: ctx.household.inviteCode,
    householdName: ctx.household.name,
    role: ctx.role,
  });
}

export async function PATCH(request: Request) {
  const { ctx, error } = await requireApiHousehold();
  if (error || !ctx) return error!;

  if (ctx.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Solo el admin puede cambiar la configuración" },
      { status: 403 }
    );
  }

  const schema = z.object({
    limitTwoUsers: z.boolean(),
  });
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const config = await prisma.appConfig.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      limitTwoUsers: parsed.data.limitTwoUsers,
    },
    update: {
      limitTwoUsers: parsed.data.limitTwoUsers,
    },
  });

  return NextResponse.json({
    limitTwoUsers: config.limitTwoUsers,
  });
}
