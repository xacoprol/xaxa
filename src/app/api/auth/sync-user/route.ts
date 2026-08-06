import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const name =
    (body.name as string) ||
    user.user_metadata?.name ||
    user.email!.split("@")[0];

  const dbUser = await prisma.user.upsert({
    where: { id: user.id },
    update: { name, email: user.email! },
    create: {
      id: user.id,
      email: user.email!,
      name,
    },
  });

  return NextResponse.json({ user: dbUser });
}
