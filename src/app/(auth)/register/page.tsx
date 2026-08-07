"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BrandLogo } from "@/components/brand/logo";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [registrationBlocked, setRegistrationBlocked] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/can-register");
        const data = await res.json();
        if (!cancelled) {
          setRegistrationBlocked(!data.allowed);
          if (!data.allowed) {
            setError(data.reason ?? "El registro está cerrado.");
          }
        }
      } catch {
        // Si falla el check, dejamos intentar y el servidor bloqueará en sync
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const gate = await fetch("/api/auth/can-register");
    const gateData = await gate.json();
    if (!gateData.allowed) {
      setError(gateData.reason ?? "El registro está cerrado.");
      setRegistrationBlocked(true);
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/callback`;
    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
        emailRedirectTo: redirectTo,
      },
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    // Sin sesión = hay que confirmar email; el usuario se crea en /auth/callback
    if (!data.session) {
      setMessage(
        "Revisa tu email para confirmar la cuenta. Después podrás iniciar sesión."
      );
      setLoading(false);
      return;
    }

    const sync = await fetch("/api/auth/sync-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!sync.ok) {
      const syncData = await sync.json().catch(() => ({}));
      setError(syncData.error ?? "No se pudo completar el registro");
      setLoading(false);
      return;
    }

    router.push("/onboarding");
    router.refresh();
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[radial-gradient(ellipse_at_top,_#c5efe6_0%,_#f4f7f6_55%)] px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <BrandLogo size="lg" />
          <h1 className="mt-4 text-xl font-semibold text-navy">Crear cuenta</h1>
        </div>
        <div className="rounded-2xl border border-stone-200/80 bg-white p-6 shadow-soft">
          {checking ? (
            <p className="text-center text-sm text-stone-400">Comprobando…</p>
          ) : registrationBlocked ? (
            <div className="space-y-4 text-center">
              <p className="rounded-lg bg-amber-50 px-3 py-3 text-sm text-amber-800">
                {error ?? "El registro está cerrado. Esta app está limitada a 2 usuarios."}
              </p>
              <Link
                href="/login"
                className="inline-flex text-sm font-medium text-navy underline"
              >
                Ir a iniciar sesión
              </Link>
            </div>
          ) : (
            <>
              <form onSubmit={onSubmit} className="space-y-4">
                <Input
                  id="name"
                  label="Nombre"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <Input
                  id="email"
                  label="Email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <Input
                  id="password"
                  label="Contraseña"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                {error && (
                  <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                    {error}
                  </p>
                )}
                {message && (
                  <p className="rounded-lg bg-teal-50 px-3 py-2 text-sm text-teal-700">
                    {message}
                  </p>
                )}
                <Button type="submit" className="w-full" loading={loading}>
                  Registrarse
                </Button>
              </form>
              <p className="mt-6 text-center text-sm text-stone-500">
                ¿Ya tienes cuenta?{" "}
                <Link href="/login" className="font-medium text-navy underline">
                  Entrar
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
