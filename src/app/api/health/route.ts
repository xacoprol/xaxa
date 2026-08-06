import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const env = {
    hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
    hasDirectUrl: Boolean(process.env.DIRECT_URL),
    hasSupabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    hasSupabaseAnon: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    hasOpenAI: Boolean(process.env.OPENAI_API_KEY),
  };

  try {
    const userCount = await prisma.user.count();
    return NextResponse.json({
      ok: true,
      env,
      userCount,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        env,
        error: error instanceof Error ? error.message : "db_error",
      },
      { status: 503 }
    );
  }
}
