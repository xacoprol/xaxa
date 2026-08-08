import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const hasCode = request.nextUrl.searchParams.has("code");
  const authType = request.nextUrl.searchParams.get("type");

  // PKCE: el code puede caer en /, /login o /reset-password → unificar en callback
  if (
    hasCode &&
    (path === "/" ||
      path === "" ||
      path.startsWith("/login") ||
      path.startsWith("/reset-password") ||
      path.startsWith("/forgot-password"))
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/callback";
    const isRecovery =
      path.startsWith("/reset-password") ||
      authType === "recovery" ||
      authType === "invite" ||
      request.nextUrl.searchParams.get("next") === "/reset-password";
    if (isRecovery) {
      url.searchParams.set("next", "/reset-password");
    }
    return NextResponse.redirect(url);
  }

  const isApi = path.startsWith("/api/");
  const isAuthForm =
    path.startsWith("/login") ||
    path.startsWith("/register") ||
    path.startsWith("/forgot-password");
  const isResetPassword = path.startsWith("/reset-password");
  const isPublic =
    path === "/" ||
    isAuthForm ||
    isResetPassword ||
    path.startsWith("/auth") ||
    isApi;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    console.error(
      "[middleware] Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
    if (!isPublic) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/login";
      return NextResponse.redirect(redirectUrl);
    }
    return NextResponse.next();
  }

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  try {
    const supabase = createServerClient(supabaseUrl, anonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          response = NextResponse.next({
            request: { headers: request.headers },
          });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    });

    // getSession = local/JWT (rápido). Evita round-trip a Auth en cada navegación.
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user ?? null;
    const mustSetPassword =
      request.cookies.get("xaxa-password-recovery")?.value === "1";

    if (!isApi) {
      if (
        user &&
        mustSetPassword &&
        !isResetPassword &&
        !path.startsWith("/auth")
      ) {
        const redirectUrl = request.nextUrl.clone();
        redirectUrl.pathname = "/reset-password";
        redirectUrl.search = "";
        return NextResponse.redirect(redirectUrl);
      }

      if (!user && !isPublic) {
        const redirectUrl = request.nextUrl.clone();
        redirectUrl.pathname = "/login";
        return NextResponse.redirect(redirectUrl);
      }

      if (user && isAuthForm) {
        const redirectUrl = request.nextUrl.clone();
        redirectUrl.pathname = mustSetPassword
          ? "/reset-password"
          : "/dashboard";
        return NextResponse.redirect(redirectUrl);
      }
    }
  } catch (error) {
    console.error("[middleware] Supabase auth error:", error);
    if (!isApi && !isPublic) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/login";
      return NextResponse.redirect(redirectUrl);
    }
  }

  return response;
}
