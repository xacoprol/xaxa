"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
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

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const supabase = createClient();
    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
      },
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    if (data.user) {
      await fetch("/api/auth/sync-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
    }

    if (data.session) {
      router.push("/onboarding");
      router.refresh();
      return;
    }

    setMessage(
      "Revisa tu email para confirmar la cuenta. Después podrás iniciar sesión."
    );
    setLoading(false);
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[radial-gradient(ellipse_at_top,_#c5efe6_0%,_#f4f7f6_55%)] px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <BrandLogo size="lg" />
          <h1 className="mt-4 text-xl font-semibold text-navy">Crear cuenta</h1>
          <p className="mt-1 text-sm text-stone-500">
            Empieza a gestionar tu hogar
          </p>
        </div>
        <div className="rounded-2xl border border-stone-200/80 bg-white p-6 shadow-soft">
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
        </div>
      </div>
    </div>
  );
}
