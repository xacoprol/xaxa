"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function OnboardingPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"create" | "join">("create");
  const [householdName, setHouseholdName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/household", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        mode === "create"
          ? { action: "create", name: householdName }
          : { action: "join", inviteCode }
      ),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Algo salió mal");
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[radial-gradient(ellipse_at_top,_#e7e5e4_0%,_#f5f5f4_50%)] px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <p className="font-display text-4xl font-semibold text-stone-900">X</p>
          <h1 className="mt-4 text-xl font-semibold text-stone-900">
            Tu hogar
          </h1>
          <p className="mt-1 text-sm text-stone-500">
            Crea un hogar nuevo o únete con un código de invitación
          </p>
        </div>

        <div className="rounded-2xl border border-stone-200/80 bg-white p-6 shadow-soft">
          <div className="mb-6 grid grid-cols-2 gap-1 rounded-xl bg-stone-100 p-1">
            <button
              type="button"
              onClick={() => setMode("create")}
              className={`rounded-lg py-2 text-sm font-medium transition ${
                mode === "create"
                  ? "bg-white text-stone-900 shadow-sm"
                  : "text-stone-500"
              }`}
            >
              Crear hogar
            </button>
            <button
              type="button"
              onClick={() => setMode("join")}
              className={`rounded-lg py-2 text-sm font-medium transition ${
                mode === "join"
                  ? "bg-white text-stone-900 shadow-sm"
                  : "text-stone-500"
              }`}
            >
              Unirme
            </button>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            {mode === "create" ? (
              <Input
                id="householdName"
                label="Nombre del hogar"
                placeholder="Familia García"
                required
                value={householdName}
                onChange={(e) => setHouseholdName(e.target.value)}
              />
            ) : (
              <Input
                id="inviteCode"
                label="Código de invitación"
                placeholder="pega el código aquí"
                required
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.trim())}
              />
            )}

            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full" loading={loading}>
              {mode === "create" ? "Crear y continuar" : "Unirme al hogar"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
