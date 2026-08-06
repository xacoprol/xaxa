import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { canRegisterNewUser } from "@/lib/app-config";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/onboarding";

  if (code) {
    const supabase = createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
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

      const destination = membership ? "/dashboard" : next;
      return NextResponse.redirect(`${origin}${destination}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
