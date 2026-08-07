"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const ALLERGY_SUGGESTIONS = [
  "lactosa",
  "gluten",
  "frutos secos",
  "huevo",
  "marisco",
  "pescado",
  "soja",
  "sésamo",
];

const DISLIKE_SUGGESTIONS = [
  "tofu",
  "hígado",
  "coles de Bruselas",
  "berenjena",
  "cilantro",
  "anchoas",
  "queso azul",
  "setas",
  "picante",
];

const GOAL_SUGGESTIONS = [
  "equilibrado",
  "ganar masa muscular",
  "perder peso",
  "más proteína",
  "bajo en carbohidratos",
  "comida rápida entre semana",
  "batch cooking",
];

const NOTE_SUGGESTIONS = [
  "Recetas fáciles, que no dé pereza hacer",
  "Comida del mediodía para llevar en tupper",
  "Comidas para 2 personas",
  "Batch cooking: lo de la noche aprovecha para el mediodía siguiente",
  "Sin horno",
  "Solo sartén, microondas y airfryer",
  "Máximo 30–40 min entre semana",
  "Cenas ligeras",
  "Ingredientes fáciles de encontrar en supermercado",
];

const MEALS_OPTIONS = [
  { value: 10, label: "10", hint: "Ligera" },
  { value: 14, label: "14", hint: "Completa" },
  { value: 21, label: "21", hint: "Intensiva" },
];

function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-xs font-medium transition",
        active
          ? "border-amber-500 bg-amber-50 text-amber-900"
          : "border-stone-200 bg-white text-stone-600 hover:border-amber-300 hover:bg-amber-50/50"
      )}
    >
      {label}
    </button>
  );
}

function ChipField({
  label,
  hint,
  selected,
  suggestions,
  onToggle,
  customValue,
  onCustomChange,
  customPlaceholder,
}: {
  label: string;
  hint?: string;
  selected: string[];
  suggestions: string[];
  onToggle: (value: string) => void;
  customValue: string;
  onCustomChange: (value: string) => void;
  customPlaceholder: string;
}) {
  const extras = selected.filter(
    (s) =>
      !suggestions.some((g) => g.toLowerCase() === s.toLowerCase())
  );

  return (
    <div className="space-y-2.5">
      <div>
        <p className="text-sm font-medium text-stone-800">{label}</p>
        {hint && <p className="text-xs text-stone-500">{hint}</p>}
      </div>
      <div className="flex flex-wrap gap-2">
        {suggestions.map((s) => (
          <Chip
            key={s}
            label={s}
            active={selected.some((x) => x.toLowerCase() === s.toLowerCase())}
            onClick={() => onToggle(s)}
          />
        ))}
        {extras.map((s) => (
          <Chip key={s} label={s} active onClick={() => onToggle(s)} />
        ))}
      </div>
      <input
        type="text"
        value={customValue}
        onChange={(e) => onCustomChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            const raw = customValue.trim().replace(/,$/, "");
            if (raw) {
              onToggle(raw);
              onCustomChange("");
            }
          }
        }}
        placeholder={customPlaceholder}
        className="h-10 w-full rounded-lg border border-stone-200 bg-white px-3 text-sm placeholder:text-stone-400 focus:border-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-900/10"
      />
    </div>
  );
}

function toggleInList(list: string[], value: string) {
  const exists = list.some((x) => x.toLowerCase() === value.toLowerCase());
  if (exists) {
    return list.filter((x) => x.toLowerCase() !== value.toLowerCase());
  }
  return [...list, value];
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
  const [allergies, setAllergies] = useState<string[]>(
    initial?.allergies ?? []
  );
  const [dislikes, setDislikes] = useState<string[]>(initial?.dislikes ?? []);
  const [goals, setGoals] = useState<string[]>(() =>
    (initial?.goal ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );
  const [mealsPerWeek, setMealsPerWeek] = useState(
    initial?.mealsPerWeek ?? 14
  );
  const [extraNotes, setExtraNotes] = useState(initial?.extraNotes ?? "");
  const [allergyCustom, setAllergyCustom] = useState("");
  const [dislikeCustom, setDislikeCustom] = useState("");
  const [goalCustom, setGoalCustom] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!initial) return;
    setAllergies(initial.allergies ?? []);
    setDislikes(initial.dislikes ?? []);
    setGoals(
      (initial.goal ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    );
    setMealsPerWeek(initial.mealsPerWeek ?? 14);
    setExtraNotes(initial.extraNotes ?? "");
  }, [initial]);

  const noteHints = useMemo(() => {
    return NOTE_SUGGESTIONS.filter(
      (n) => !extraNotes.toLowerCase().includes(n.toLowerCase().slice(0, 18))
    );
  }, [extraNotes]);

  function appendNote(snippet: string) {
    setExtraNotes((prev) => {
      const trimmed = prev.trim();
      if (!trimmed) return snippet.endsWith(".") ? snippet : `${snippet}.`;
      const sep = trimmed.endsWith(".") || trimmed.endsWith("!") ? " " : ". ";
      return `${trimmed}${sep}${snippet.endsWith(".") ? snippet : `${snippet}.`}`;
    });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const res = await fetch("/api/menus/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        allergies,
        dislikes,
        goal: goals.length ? goals.join(", ") : null,
        mealsPerWeek,
        extraNotes: extraNotes.trim() || null,
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
    <form onSubmit={onSubmit} className="space-y-7">
      <ChipField
        label="Alergias e intolerancias"
        hint="Toca para activar · Enter para añadir otra"
        selected={allergies}
        suggestions={ALLERGY_SUGGESTIONS}
        onToggle={(v) => setAllergies((prev) => toggleInList(prev, v))}
        customValue={allergyCustom}
        onCustomChange={setAllergyCustom}
        customPlaceholder="Otra alergia…"
      />

      <ChipField
        label="No me gusta"
        hint="La IA evitará estos ingredientes"
        selected={dislikes}
        suggestions={DISLIKE_SUGGESTIONS}
        onToggle={(v) => setDislikes((prev) => toggleInList(prev, v))}
        customValue={dislikeCustom}
        onCustomChange={setDislikeCustom}
        customPlaceholder="Otro que no te guste…"
      />

      <ChipField
        label="Objetivo"
        hint="Puedes combinar varios"
        selected={goals}
        suggestions={GOAL_SUGGESTIONS}
        onToggle={(v) => setGoals((prev) => toggleInList(prev, v))}
        customValue={goalCustom}
        onCustomChange={setGoalCustom}
        customPlaceholder="Otro objetivo…"
      />

      <div className="space-y-2.5">
        <div>
          <p className="text-sm font-medium text-stone-800">
            Comidas a cubrir / semana
          </p>
          <p className="text-xs text-stone-500">
            Comidas + cenas · ahora {mealsPerWeek}
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {MEALS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setMealsPerWeek(opt.value)}
              className={cn(
                "rounded-xl border px-3 py-3 text-center transition",
                mealsPerWeek === opt.value
                  ? "border-amber-500 bg-amber-50"
                  : "border-stone-200 bg-white hover:border-amber-300"
              )}
            >
              <p className="font-display text-xl font-semibold text-stone-900">
                {opt.label}
              </p>
              <p className="text-[11px] text-stone-500">{opt.hint}</p>
            </button>
          ))}
        </div>
        <input
          type="range"
          min={7}
          max={21}
          value={mealsPerWeek}
          onChange={(e) => setMealsPerWeek(Number(e.target.value))}
          className="w-full accent-amber-600"
        />
      </div>

      <div className="space-y-2.5">
        <div>
          <p className="text-sm font-medium text-stone-800">Notas extra</p>
          <p className="text-xs text-stone-500">
            Cocina, utensilios, tupper, batch cooking…
          </p>
        </div>
        {noteHints.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {noteHints.map((n) => (
              <Chip key={n} label={`+ ${n}`} onClick={() => appendNote(n)} />
            ))}
          </div>
        )}
        <Textarea
          id="notes"
          value={extraNotes}
          onChange={(e) => setExtraNotes(e.target.value)}
          rows={5}
          placeholder="Ej.: Sin horno. Sartén, microondas y airfryer. Comida para llevar en tupper…"
          className="min-h-[120px]"
        />
      </div>

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
      <Button type="submit" variant="amber" loading={loading} className="w-full sm:w-auto">
        Guardar preferencias
      </Button>
    </form>
  );
}
