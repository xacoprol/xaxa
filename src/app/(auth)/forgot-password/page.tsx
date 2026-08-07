"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/callback?next=/reset-password`;
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email,
      { redirectTo }
    );

    setLoading(false);
    if (resetError) {
      setError(resetError.message);
      return;
    }
    setSent(true);
  }

  return (
    <AuthShell>
      {sent ? (
        <div className="space-y-4 text-center">
          <p className="text-sm text-stone-700">
            Si existe una cuenta con <span className="font-medium">{email}</span>,
            te hemos enviado un enlace para restablecer la contraseña.
          </p>
          <p className="text-xs text-stone-500">
            Revisa también la carpeta de spam.
          </p>
          <Link
            href="/login"
            className="inline-block text-sm font-medium text-navy underline"
          >
            Volver a entrar
          </Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <p className="text-sm text-stone-600">
            Escribe tu email y te enviaremos un enlace para crear una nueva
            contraseña.
          </p>
          <Input
            id="email"
            label="Email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full" loading={loading}>
            Enviar enlace
          </Button>
          <p className="text-center text-sm text-stone-500">
            <Link href="/login" className="font-medium text-navy underline">
              Volver
            </Link>
          </p>
        </form>
      )}
    </AuthShell>
  );
}
