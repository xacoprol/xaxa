"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function clearRecoveryFlag() {
  try {
    document.cookie =
      "xaxa-password-recovery=; Path=/; Max-Age=0; SameSite=Lax";
  } catch {
    // ignore
  }
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    async function establishSession() {
      const params = new URLSearchParams(window.location.search);
      if (params.get("error") === "link") {
        if (!cancelled) {
          setReady(false);
          setChecking(false);
          setError("El enlace no es válido o ha caducado.");
        }
        return;
      }

      // Fallback PKCE si el code llega aquí sin pasar por /auth/callback
      const code = params.get("code");
      if (code) {
        const { error: exchangeError } =
          await supabase.auth.exchangeCodeForSession(code);
        if (!cancelled) {
          if (exchangeError) {
            setReady(false);
            setError("El enlace no es válido o ha caducado.");
          } else {
            setReady(true);
            window.history.replaceState({}, "", "/reset-password");
          }
          setChecking(false);
        }
        return;
      }

      // Flujo implícito antiguo: tokens en el hash
      const hash = window.location.hash.replace(/^#/, "");
      if (hash) {
        const hashParams = new URLSearchParams(hash);
        const access_token = hashParams.get("access_token");
        const refresh_token = hashParams.get("refresh_token");
        const type = hashParams.get("type");
        if (access_token && refresh_token && type === "recovery") {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token,
            refresh_token,
          });
          if (!cancelled) {
            if (sessionError) {
              setReady(false);
              setError("El enlace no es válido o ha caducado.");
            } else {
              setReady(true);
              window.history.replaceState({}, "", "/reset-password");
            }
            setChecking(false);
          }
          return;
        }
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!cancelled) {
        setReady(!!session);
        setChecking(false);
        if (!session) {
          setError("El enlace no es válido o ha caducado.");
        }
      }
    }

    void establishSession();

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setReady(true);
        setChecking(false);
        setError(null);
      }
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres");
      return;
    }
    if (password !== confirm) {
      setError("Las contraseñas no coinciden");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });
    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    clearRecoveryFlag();
    router.push("/dashboard");
    router.refresh();
  }

  if (checking) {
    return (
      <AuthShell>
        <p className="text-center text-sm text-stone-500">
          Comprobando enlace…
        </p>
      </AuthShell>
    );
  }

  if (!ready) {
    return (
      <AuthShell>
        <div className="space-y-4 text-center">
          <p className="text-sm text-stone-700">
            {error ?? "El enlace no es válido o ha caducado. Pide uno nuevo."}
          </p>
          <Link
            href="/forgot-password"
            className="inline-block text-sm font-medium text-navy underline"
          >
            Recuperar contraseña
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <h1 className="font-display text-xl font-semibold text-navy">
            Nueva contraseña
          </h1>
          <p className="mt-1 text-sm text-stone-600">
            Elige tu nueva contraseña para entrar en X.
          </p>
        </div>
        <Input
          id="password"
          label="Nueva contraseña"
          type="password"
          autoComplete="new-password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Input
          id="confirm"
          label="Repetir contraseña"
          type="password"
          autoComplete="new-password"
          required
          minLength={6}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        <Button type="submit" className="w-full" loading={loading}>
          Guardar contraseña
        </Button>
      </form>
    </AuthShell>
  );
}
