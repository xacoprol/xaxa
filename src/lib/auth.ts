import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";

export async function getSessionUser() {
  try {
    if (
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ) {
      return null;
    }
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user;
  } catch (error) {
    console.error("[auth] getSessionUser:", error);
    return null;
  }
}

export async function ensureDbUser() {
  const authUser = await getSessionUser();
  if (!authUser) return null;

  let dbUser = await prisma.user.findUnique({
    where: { id: authUser.id },
  });

  if (!dbUser) {
    const { canRegisterNewUser } = await import("@/lib/app-config");
    const gate = await canRegisterNewUser();
    if (!gate.allowed) {
      return null;
    }

    dbUser = await prisma.user.create({
      data: {
        id: authUser.id,
        email: authUser.email!,
        name:
          authUser.user_metadata?.name ??
          authUser.email!.split("@")[0],
      },
    });
  }

  return dbUser;
}

export async function requireUser() {
  const user = await ensureDbUser();
  if (!user) redirect("/login");
  return user;
}

/** Para Route Handlers: no redirige, responde 401. */
export async function requireApiUser() {
  const user = await ensureDbUser();
  if (!user) {
    return {
      user: null as null,
      error: NextResponse.json({ error: "No autenticado" }, { status: 401 }),
    };
  }
  return { user, error: null };
}

export async function requireHousehold() {
  const user = await requireUser();

  const membership = await prisma.householdMember.findFirst({
    where: { userId: user.id },
    include: {
      household: {
        include: {
          members: {
            include: { user: true },
            orderBy: { joinedAt: "asc" },
          },
        },
      },
    },
    orderBy: { joinedAt: "asc" },
  });

  if (!membership) redirect("/onboarding");

  return {
    user,
    membership,
    household: membership.household,
    members: membership.household.members,
    role: membership.role,
  };
}

export async function requireApiHousehold() {
  const { user, error } = await requireApiUser();
  if (error || !user) return { ctx: null, error: error! };

  const membership = await prisma.householdMember.findFirst({
    where: { userId: user.id },
    include: {
      household: {
        include: {
          members: {
            include: { user: true },
            orderBy: { joinedAt: "asc" },
          },
        },
      },
    },
    orderBy: { joinedAt: "asc" },
  });

  if (!membership) {
    return {
      ctx: null,
      error: NextResponse.json(
        { error: "Sin hogar asignado" },
        { status: 403 }
      ),
    };
  }

  return {
    ctx: {
      user,
      membership,
      household: membership.household,
      members: membership.household.members,
      role: membership.role,
    },
    error: null,
  };
}
