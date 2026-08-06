"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Heart, RefreshCw, ShoppingCart, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DAY_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";

type Meal = {
  id: string;
  dayOfWeek: number;
  mealType: "COMIDA" | "CENA";
  name: string;
  ingredients: unknown;
  steps: string[];
  estimatedMins: number | null;
  isFavorite: boolean;
};

type ShoppingItem = {
  name: string;
  nameKey?: string;
  quantities: string[];
  count: number;
  unitPrice: number | null;
  source: "saved" | "default" | null;
};

export function MenusView({
  weekStartIso,
  meals,
}: {
  weekStartIso: string;
  meals: Meal[];
}) {
  const router = useRouter();
  const [generating, setGenerating] = useState(false);
  const [regenDay, setRegenDay] = useState<number | null>(null);
  const [shopping, setShopping] = useState<ShoppingItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Meal | null>(null);
  const [savingPrice, setSavingPrice] = useState<string | null>(null);

  const shoppingTotals = useMemo(() => {
    if (!shopping) return { estimatedTotal: 0, pricedCount: 0 };
    const priced = shopping.filter((i) => i.unitPrice != null);
    const estimatedTotal =
      Math.round(priced.reduce((s, i) => s + (i.unitPrice ?? 0), 0) * 100) /
      100;
    return { estimatedTotal, pricedCount: priced.length };
  }, [shopping]);

  const byDay = useMemo(() => {
    const map: Record<number, { COMIDA?: Meal; CENA?: Meal }> = {};
    for (let d = 0; d < 7; d++) map[d] = {};
    for (const m of meals) {
      map[m.dayOfWeek][m.mealType] = m;
    }
    return map;
  }, [meals]);

  async function generate(days?: number[]) {
    setError(null);
    if (days) setRegenDay(days[0]);
    else setGenerating(true);

    const res = await fetch("/api/menus/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weekStart: weekStartIso, days }),
    });
    const data = await res.json();
    if (!res.ok) setError(data.error ?? "Error al generar");
    setGenerating(false);
    setRegenDay(null);
    router.refresh();
  }

  async function toggleFavorite(id: string) {
    await fetch(`/api/menus/meals/${id}/favorite`, { method: "PATCH" });
    router.refresh();
  }

  async function loadShopping() {
    const res = await fetch(
      `/api/menus/shopping-list?weekStart=${weekStartIso}`
    );
    const data = await res.json();
    setShopping(data.items ?? []);
  }

  async function savePrice(name: string, unitPrice: number) {
    setSavingPrice(name);
    const res = await fetch("/api/menus/ingredient-prices", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, unitPrice }),
    });
    setSavingPrice(null);
    if (!res.ok) return;

    setShopping((prev) =>
      prev
        ? prev.map((item) =>
            item.name === name
              ? { ...item, unitPrice, source: "saved" as const }
              : item
          )
        : prev
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-amber-600">
            Menús
          </p>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-stone-900">
            Semana
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={loadShopping}
            disabled={!meals.length}
          >
            <ShoppingCart className="h-4 w-4" />
            Lista compra
          </Button>
          <Button
            variant="amber"
            size="sm"
            loading={generating}
            onClick={() => generate()}
          >
            <Sparkles className="h-4 w-4" />
            Generar menú
          </Button>
        </div>
      </header>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {/* Calendar grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
        {DAY_LABELS.map((label, day) => {
          const comida = byDay[day].COMIDA;
          const cena = byDay[day].CENA;
          return (
            <div
              key={label}
              className="rounded-2xl border border-stone-200/80 bg-white p-3 shadow-soft"
            >
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                  {label.slice(0, 3)}
                </p>
                <button
                  type="button"
                  title="Regenerar día"
                  disabled={regenDay === day}
                  onClick={() => generate([day])}
                  className="rounded-md p-1 text-stone-400 hover:bg-amber-50 hover:text-amber-700 disabled:opacity-50"
                >
                  <RefreshCw
                    className={cn(
                      "h-3.5 w-3.5",
                      regenDay === day && "animate-spin"
                    )}
                  />
                </button>
              </div>
              <MealChip
                label="Comida"
                meal={comida}
                onOpen={setSelected}
                onFavorite={toggleFavorite}
              />
              <MealChip
                label="Cena"
                meal={cena}
                onOpen={setSelected}
                onFavorite={toggleFavorite}
              />
            </div>
          );
        })}
      </div>

      {shopping && (
        <section className="rounded-2xl border border-amber-100 bg-amber-50/50 p-5">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="font-display text-lg font-semibold text-stone-900">
                Lista de la compra
              </h2>
              <p className="text-xs text-stone-500">
                Precios orientativos · edítalos para mejorar el estimado
              </p>
            </div>
            <button
              type="button"
              className="text-sm text-stone-500 underline"
              onClick={() => setShopping(null)}
            >
              Cerrar
            </button>
          </div>

          {shopping.length === 0 ? (
            <p className="text-sm text-stone-500">Sin ingredientes</p>
          ) : (
            <>
              <ul className="space-y-2">
                {shopping.map((item) => (
                  <li
                    key={item.name}
                    className="flex flex-wrap items-center gap-2 rounded-xl bg-white/80 px-3 py-2 text-sm text-stone-700"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-stone-900">{item.name}</p>
                      <p className="text-xs text-stone-400">
                        {item.quantities.length > 0
                          ? item.quantities.join(" + ")
                          : item.count > 1
                            ? `×${item.count}`
                            : "—"}
                        {item.source === "saved"
                          ? " · precio guardado"
                          : item.source === "default"
                            ? " · estimado"
                            : " · sin precio"}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-stone-400">€</span>
                      <input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step={0.1}
                        className="h-8 w-20 rounded-lg border border-stone-200 bg-white px-2 text-right text-sm"
                        value={item.unitPrice ?? ""}
                        placeholder="—"
                        disabled={savingPrice === item.name}
                        onChange={(e) => {
                          const raw = e.target.value;
                          const value =
                            raw === "" ? null : parseFloat(raw);
                          setShopping((prev) =>
                            prev
                              ? prev.map((row) =>
                                  row.name === item.name
                                    ? {
                                        ...row,
                                        unitPrice:
                                          value != null && !Number.isNaN(value)
                                            ? value
                                            : null,
                                      }
                                    : row
                                )
                              : prev
                          );
                        }}
                        onBlur={(e) => {
                          const value = parseFloat(e.target.value);
                          if (!Number.isNaN(value) && value >= 0) {
                            void savePrice(item.name, value);
                          }
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ul>

              <div className="mt-4 flex items-center justify-between rounded-xl border border-amber-200 bg-white px-4 py-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-amber-700/80">
                    Total estimado
                  </p>
                  <p className="text-xs text-stone-400">
                    {shoppingTotals.pricedCount}/{shopping.length} con precio
                  </p>
                </div>
                <p className="font-display text-2xl font-semibold text-navy">
                  {shoppingTotals.estimatedTotal.toLocaleString("es-ES", {
                    style: "currency",
                    currency: "EUR",
                  })}
                </p>
              </div>
            </>
          )}
        </section>
      )}

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-stone-900/40 p-4 sm:items-center"
          onClick={() => setSelected(null)}
        >
          <div
            className="max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-xs font-medium uppercase tracking-wider text-amber-600">
              {DAY_LABELS[selected.dayOfWeek]} · {selected.mealType}
            </p>
            <h3 className="font-display mt-1 text-2xl font-semibold text-stone-900">
              {selected.name}
            </h3>
            {selected.estimatedMins && (
              <p className="mt-1 text-sm text-stone-500">
                ~{selected.estimatedMins} min
              </p>
            )}
            <h4 className="mt-4 text-sm font-semibold text-stone-800">
              Ingredientes
            </h4>
            <ul className="mt-1 list-inside list-disc text-sm text-stone-600">
              {(Array.isArray(selected.ingredients)
                ? selected.ingredients
                : []
              ).map((ing, i) => (
                <li key={i}>
                  {typeof ing === "string"
                    ? ing
                    : `${(ing as { name: string }).name}${
                        (ing as { quantity?: string }).quantity
                          ? ` — ${(ing as { quantity?: string }).quantity}${
                              (ing as { unit?: string }).unit
                                ? ` ${(ing as { unit?: string }).unit}`
                                : ""
                            }`
                          : ""
                      }`}
                </li>
              ))}
            </ul>
            <h4 className="mt-4 text-sm font-semibold text-stone-800">Pasos</h4>
            <ol className="mt-1 list-inside list-decimal space-y-1 text-sm text-stone-600">
              {selected.steps.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
            <Button
              className="mt-5 w-full"
              variant="secondary"
              onClick={() => setSelected(null)}
            >
              Cerrar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function MealChip({
  label,
  meal,
  onOpen,
  onFavorite,
}: {
  label: string;
  meal?: Meal;
  onOpen: (m: Meal) => void;
  onFavorite: (id: string) => void;
}) {
  if (!meal) {
    return (
      <div className="mb-2 rounded-lg bg-stone-50 px-2 py-2">
        <p className="text-[10px] uppercase tracking-wide text-stone-400">
          {label}
        </p>
        <p className="text-xs text-stone-300">—</p>
      </div>
    );
  }

  return (
    <div className="mb-2 rounded-lg bg-amber-50/60 px-2 py-2">
      <div className="flex items-start justify-between gap-1">
        <button
          type="button"
          onClick={() => onOpen(meal)}
          className="min-w-0 text-left"
        >
          <p className="text-[10px] uppercase tracking-wide text-amber-700/70">
            {label}
          </p>
          <p className="line-clamp-2 text-xs font-medium text-stone-800">
            {meal.name}
          </p>
        </button>
        <button
          type="button"
          onClick={() => onFavorite(meal.id)}
          className="shrink-0 p-0.5"
          aria-label="Favorito"
        >
          <Heart
            className={cn(
              "h-3.5 w-3.5",
              meal.isFavorite
                ? "fill-amber-500 text-amber-500"
                : "text-stone-300"
            )}
          />
        </button>
      </div>
    </div>
  );
}
