import { NextResponse } from "next/server";
import { requireApiHousehold } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Identidad ligera para el shell (cacheable en cliente). */
export async function GET() {
  const { ctx, error } = await requireApiHousehold();
  if (error || !ctx) return error!;

  return NextResponse.json({
    userName: ctx.user.name,
    householdName: ctx.household.name,
  });
}
