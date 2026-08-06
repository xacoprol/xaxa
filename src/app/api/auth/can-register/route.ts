import { NextResponse } from "next/server";
import { canRegisterNewUser } from "@/lib/app-config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Público: la página de registro consulta si se permiten altas. */
export async function GET() {
  try {
    const result = await canRegisterNewUser();
    return NextResponse.json({
      allowed: result.allowed,
      reason: "reason" in result ? result.reason : null,
      limitTwoUsers: result.config.limitTwoUsers,
      userCount: result.userCount,
    });
  } catch (error) {
    console.error("[can-register]", error);
    return NextResponse.json(
      {
        allowed: false,
        reason: "No se pudo comprobar el registro. Revisa la base de datos.",
        error: error instanceof Error ? error.message : "db_error",
      },
      { status: 503 }
    );
  }
}
