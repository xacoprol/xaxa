import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";

export const getSessionUser = cache(async () => {
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
});

export const ensureDbUser = cache(async () => {
  const authUser = await getSessionUser();
  if (!authUser) return null;

  try {
    let dbUser = await prisma.user.findUnique({
      where: { id: authUser.id },
      select: { id: true, email: true, name: true, avatarUrl: true, createdAt: true, updatedAt: true },
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
        select: { id: true, email: true, name: true, avatarUrl: true, createdAt: true, updatedAt: true },
      });
    }

    return dbUser;
  } catch (error) {
    console.error("[auth] ensureDbUser / Prisma:", error);
    throw new Error(
      "No se pudo conectar con la base de datos. Revisa DATABASE_URL y DIRECT_URL en Vercel."
    );
  }
});

export async function requireUser() {
  const user = await ensureDbUser();
  if (!user) redirect("/login");
  return user;
}

/** Para Route Handlers: no redirige, responde 401. */
export async function requireApiUser() {
  try {
    const user = await ensureDbUser();
    if (!user) {
      return {
        user: null as null,
        error: NextResponse.json({ error: "No autenticado" }, { status: 401 }),
      };
    }
    return { user, error: null };
  } catch (error) {
    console.error("[auth] requireApiUser:", error);
    return {
      user: null as null,
      error: NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Error de base de datos",
        },
        { status: 503 }
      ),
    };
  }
}

export const requireHousehold = cache(async () => {
  const user = await requireUser();

  try {
    const membership = await prisma.householdMember.findFirst({
      where: { userId: user.id },
      include: {
        household: {
          include: {
            members: {
              include: {
                user: {
                  select: { id: true, name: true, email: true },
                },
              },
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
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "digest" in error &&
      String((error as { digest?: string }).digest).startsWith("NEXT_REDIRECT")
    ) {
      throw error;
    }
    console.error("[auth] requireHousehold / Prisma:", error);
    throw new Error(
      "No se pudo conectar con la base de datos. Revisa DATABASE_URL y DIRECT_URL en Vercel."
    );
  }
});

export async function requireApiHousehold() {
  const { user, error } = await requireApiUser();
  if (error || !user) return { ctx: null, error: error! };

  try {
    // Reutiliza el cache de requireHousehold cuando se llama desde el mismo request RSC;
    // en Route Handlers es una sola llamada.
    const membership = await prisma.householdMember.findFirst({
      where: { userId: user.id },
      include: {
        household: {
          include: {
            members: {
              include: {
                user: { select: { id: true, name: true, email: true } },
              },
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
  } catch (err) {
    console.error("[auth] requireApiHousehold:", err);
    return {
      ctx: null,
      error: NextResponse.json(
        { error: "Error de base de datos" },
        { status: 503 }
      ),
    };
  }
}
