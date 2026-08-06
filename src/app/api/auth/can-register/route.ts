import { NextResponse } from "next/server";
import { canRegisterNewUser } from "@/lib/app-config";

/** Público: la página de registro consulta si se permiten altas. */
export async function GET() {
  const result = await canRegisterNewUser();
  return NextResponse.json({
    allowed: result.allowed,
    reason: "reason" in result ? result.reason : null,
    limitTwoUsers: result.config.limitTwoUsers,
    userCount: result.userCount,
  });
}
