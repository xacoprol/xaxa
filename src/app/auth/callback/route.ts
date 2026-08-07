import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { canRegisterNewUser } from "@/lib/app-config";

export const runtime = "nodejs";

function siteOrigin(request: Request) {
  const url = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";
  if (forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }
  return url.origin;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/onboarding";
  const origin = siteOrigin(request);

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=auth`);
  }

  const allowedNext = new Set(["/onboarding", "/dashboard", "/reset-password"]);
  const safeNext = allowedNext.has(next) ? next : "/onboarding";

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    console.error("[auth/callback] Missing Supabase env");
    return NextResponse.redirect(`${origin}/login?error=config`);
  }

  try {
    const cookieStore = cookies();
    const supabase = createServerClient(supabaseUrl, anonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    });

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error || !data.user) {
      console.error("[auth/callback] exchange failed:", error?.message);
      return NextResponse.redirect(`${origin}/login?error=auth`);
    }

    try {
      const existing = await prisma.user.findUnique({
        where: { id: data.user.id },
      });

      if (!existing) {
        const gate = await canRegisterNewUser();
        if (gate.allowed) {
          await prisma.user.create({
            data: {
              id: data.user.id,
              email: data.user.email!,
              name:
                data.user.user_metadata?.name ??
                data.user.email!.split("@")[0],
            },
          });
        }
      }

      const membership = await prisma.householdMember.findFirst({
        where: { userId: data.user.id },
      });

      // Recuperación de contraseña: respetar next aunque ya tenga hogar
      const destination =
        safeNext === "/reset-password"
          ? "/reset-password"
          : membership
            ? "/dashboard"
            : safeNext;
      return NextResponse.redirect(`${origin}${destination}`);
    } catch (dbError) {
      console.error("[auth/callback] db error:", dbError);
      if (safeNext === "/reset-password") {
        return NextResponse.redirect(`${origin}/reset-password`);
      }
      // Sesión ok aunque falle Prisma: manda a onboarding
      return NextResponse.redirect(`${origin}/onboarding`);
    }
  } catch (error) {
    console.error("[auth/callback] unexpected:", error);
    return NextResponse.redirect(`${origin}/login?error=auth`);
  }
}
