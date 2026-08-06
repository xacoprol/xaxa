"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SettingsForm({
  initialLimitTwoUsers,
  userCount,
  maxUsers,
  inviteCode,
  householdName,
  isAdmin,
}: {
  initialLimitTwoUsers: boolean;
  userCount: number;
  maxUsers: number;
  inviteCode: string;
  householdName: string;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [limitTwoUsers, setLimitTwoUsers] = useState(initialLimitTwoUsers);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function save(next: boolean) {
    if (!isAdmin) return;
    setLoading(true);
    setError(null);
    setMessage(null);

    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ limitTwoUsers: next }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "No se pudo guardar");
      setLimitTwoUsers(!next);
      setLoading(false);
      return;
    }

    setLimitTwoUsers(data.limitTwoUsers);
    setMessage("Guardado");
    setLoading(false);
    router.refresh();
  }

  async function copyInvite() {
    await navigator.clipboard.writeText(inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-stone-200/80 bg-white p-5 shadow-soft">
        <h2 className="font-display text-lg font-semibold text-navy">
          Registro de usuarios
        </h2>
        <p className="mt-1 text-sm text-stone-500">
          Hay {userCount} usuario{userCount === 1 ? "" : "s"} en la app.
        </p>

        <label
          className={cn(
            "mt-4 flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition",
            limitTwoUsers
              ? "border-teal/40 bg-teal-50/60"
              : "border-stone-200 bg-stone-50/50",
            !isAdmin && "cursor-not-allowed opacity-70"
          )}
        >
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 rounded border-stone-300 text-teal focus:ring-teal"
            checked={limitTwoUsers}
            disabled={!isAdmin || loading}
            onChange={(e) => {
              const next = e.target.checked;
              setLimitTwoUsers(next);
              void save(next);
            }}
          />
          <span>
            <span className="block text-sm font-medium text-navy">
              Limitar a {maxUsers} usuarios
            </span>
            <span className="mt-0.5 block text-sm text-stone-500">
              Si está activo, no se podrán registrar más cuentas cuando ya haya{" "}
              {maxUsers}.
            </span>
          </span>
        </label>

        {!isAdmin && (
          <p className="mt-3 text-xs text-stone-400">
            Solo el admin del hogar puede cambiar esta opción.
          </p>
        )}

        {error && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        {message && (
          <p className="mt-3 text-sm text-teal-700">{message}</p>
        )}
      </section>

      <section className="rounded-2xl border border-stone-200/80 bg-white p-5 shadow-soft">
        <h2 className="font-display text-lg font-semibold text-navy">
          Hogar
        </h2>
        <p className="mt-1 text-sm text-stone-500">{householdName}</p>
        <p className="mt-4 text-xs font-medium uppercase tracking-wider text-stone-400">
          Código de invitación
        </p>
        <div className="mt-1.5 flex items-center gap-2">
          <code className="flex-1 truncate rounded-lg bg-stone-100 px-3 py-2 font-mono text-sm text-navy">
            {inviteCode}
          </code>
          <Button type="button" variant="secondary" size="sm" onClick={copyInvite}>
            {copied ? "Copiado" : "Copiar"}
          </Button>
        </div>
      </section>
    </div>
  );
}
