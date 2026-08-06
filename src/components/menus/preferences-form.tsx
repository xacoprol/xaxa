"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

function parseList(value: string) {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function PreferencesForm({
  initial,
}: {
  initial: {
    allergies: string[];
    dislikes: string[];
    goal: string | null;
    mealsPerWeek: number;
    extraNotes: string | null;
  } | null;
}) {
  const router = useRouter();
  const [allergies, setAllergies] = useState(
    (initial?.allergies ?? []).join(", ")
  );
  const [dislikes, setDislikes] = useState(
    (initial?.dislikes ?? []).join(", ")
  );
  const [goal, setGoal] = useState(initial?.goal ?? "");
  const [mealsPerWeek, setMealsPerWeek] = useState(
    String(initial?.mealsPerWeek ?? 14)
  );
  const [extraNotes, setExtraNotes] = useState(initial?.extraNotes ?? "");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const res = await fetch("/api/menus/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        allergies: parseList(allergies),
        dislikes: parseList(dislikes),
        goal: goal || null,
        mealsPerWeek: Number(mealsPerWeek),
        extraNotes: extraNotes || null,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Error al guardar");
      setLoading(false);
      return;
    }

    setMessage("Preferencias guardadas");
    setLoading(false);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Input
        id="allergies"
        label="Alergias (separadas por comas)"
        placeholder="gluten, lactosa…"
        value={allergies}
        onChange={(e) => setAllergies(e.target.value)}
      />
      <Input
        id="dislikes"
        label="No me gusta"
        placeholder="hígado, coles de Bruselas…"
        value={dislikes}
        onChange={(e) => setDislikes(e.target.value)}
      />
      <Input
        id="goal"
        label="Objetivo"
        placeholder="equilibrado, perder peso…"
        value={goal}
        onChange={(e) => setGoal(e.target.value)}
      />
      <Input
        id="meals"
        label="Comidas a cubrir / semana"
        type="number"
        min={1}
        max={21}
        value={mealsPerWeek}
        onChange={(e) => setMealsPerWeek(e.target.value)}
      />
      <Textarea
        id="notes"
        label="Notas extra"
        value={extraNotes}
        onChange={(e) => setExtraNotes(e.target.value)}
      />
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      {message && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {message}
        </p>
      )}
      <Button type="submit" variant="amber" loading={loading}>
        Guardar preferencias
      </Button>
    </form>
  );
}
