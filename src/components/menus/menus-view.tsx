"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Clock,
  Heart,
  ImagePlus,
  RefreshCw,
  ShoppingCart,
  Sparkles,
  Users,
  BookHeart,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PreferencesForm } from "@/components/menus/preferences-form";
import { DAY_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";

type Difficulty = "FACIL" | "MEDIA" | "ELABORADA";

type Meal = {
  id: string;
  dayOfWeek: number;
  mealType: "DESAYUNO" | "COMIDA" | "CENA";
  name: string;
  description?: string | null;
  ingredients: unknown;
  steps: string[];
  servings?: number;
  difficulty?: Difficulty;
  tags?: string[];
  imageUrl?: string | null;
  prepMins?: number | null;
  cookMins?: number | null;
  estimatedMins: number | null;
  isFavorite: boolean;
};

type Recipe = {
  id: string;
  name: string;
  description: string | null;
  ingredients: unknown;
  steps: string[];
  servings: number;
  difficulty: Difficulty;
  tags: string[];
  imageUrl: string | null;
  prepMins: number | null;
  cookMins: number | null;
  estimatedMins: number | null;
};

type ShoppingItem = {
  name: string;
  nameKey?: string;
  quantities: string[];
  totalQty?: string | null;
  count: number;
  unitPrice: number | null;
  source: "saved" | "default" | null;
};

type DetailItem =
  | ({ kind: "meal" } & Meal)
  | ({ kind: "recipe" } & Recipe);

const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  FACIL: "Fácil",
  MEDIA: "Media",
  ELABORADA: "Elaborada",
};

function checkedKey(weekStartIso: string) {
  return `xaxa:shopping-checked:${weekStartIso}`;
}

function loadChecked(weekStartIso: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(checkedKey(weekStartIso));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    return new Set(
      Array.isArray(parsed)
        ? parsed.filter((x) => typeof x === "string")
        : []
    );
  } catch {
    return new Set();
  }
}

function saveChecked(weekStartIso: string, checked: Set<string>) {
  localStorage.setItem(
    checkedKey(weekStartIso),
    JSON.stringify(Array.from(checked))
  );
}

function formatIngredient(ing: unknown): string {
  if (typeof ing === "string") return ing;
  if (ing && typeof ing === "object" && "name" in ing) {
    const o = ing as { name: string; quantity?: string | number; unit?: string };
    const qty =
      o.quantity != null
        ? ` — ${o.quantity}${o.unit ? ` ${o.unit}` : ""}`
        : "";
    return `${o.name}${qty}`;
  }
  return String(ing);
}

type PreferenceInitial = {
  allergies: string[];
  dislikes: string[];
  goal: string | null;
  mealsPerWeek: number;
  extraNotes: string | null;
};

export function MenusView({
  weekStartIso,
  meals: initialMeals,
  preferenceInitial,
}: {
  weekStartIso: string;
  meals: Meal[];
  preferenceInitial: PreferenceInitial | null;
}) {
  const router = useRouter();
  const [meals, setMeals] = useState<Meal[]>(initialMeals);
  const [generating, setGenerating] = useState(false);
  const [imaging, setImaging] = useState(false);
  const [regenDay, setRegenDay] = useState<number | null>(null);
  const [shopping, setShopping] = useState<ShoppingItem[] | null>(null);
  const [checked, setChecked] = useState<Set<string>>(() => new Set());
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<DetailItem | null>(null);
  const [savingPrice, setSavingPrice] = useState<string | null>(null);
  const [tab, setTab] = useState<"semana" | "favoritos">("semana");
  const [recipes, setRecipes] = useState<Recipe[] | null>(null);
  const [loadingRecipes, setLoadingRecipes] = useState(false);
  const [confirmGenerate, setConfirmGenerate] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [photoLoadingId, setPhotoLoadingId] = useState<string | null>(null);

  useEffect(() => {
    setMeals(initialMeals);
  }, [initialMeals]);

  useEffect(() => {
    setChecked(loadChecked(weekStartIso));
  }, [weekStartIso]);

  const fillImages = useCallback(
    async (mealIds?: string[]) => {
      setImaging(true);
      let guard = 0;
      try {
        while (guard < 14) {
          guard += 1;
          const res = await fetch("/api/menus/images", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              mealIds,
              limit: 2,
            }),
          });
          const data = await res.json();
          if (!res.ok) break;

          if (Array.isArray(data.updated) && data.updated.length) {
            setMeals((prev) =>
              prev.map((m) => {
                const hit = data.updated.find(
                  (u: { id: string; imageUrl: string }) => u.id === m.id
                );
                return hit ? { ...m, imageUrl: hit.imageUrl } : m;
              })
            );
          }

          if (data.done) break;
          if (!data.updated?.length) break;
        }
      } finally {
        setImaging(false);
        router.refresh();
      }
    },
    [router]
  );

  useEffect(() => {
    const missing = meals.filter((m) => !m.imageUrl).map((m) => m.id);
    if (missing.length && !imaging && !generating) {
      void fillImages(missing);
    }
    // Solo al montar / cambiar semana con huecos
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStartIso]);

  const shoppingTotals = useMemo(() => {
    if (!shopping) return { estimatedTotal: 0, pricedCount: 0, done: 0 };
    const priced = shopping.filter((i) => i.unitPrice != null);
    const estimatedTotal =
      Math.round(priced.reduce((s, i) => s + (i.unitPrice ?? 0), 0) * 100) /
      100;
    const done = shopping.filter((i) => checked.has(i.name)).length;
    return { estimatedTotal, pricedCount: priced.length, done };
  }, [shopping, checked]);

  const orderedShopping = useMemo(() => {
    if (!shopping) return [];
    return [...shopping].sort((a, b) => {
      const aDone = checked.has(a.name) ? 1 : 0;
      const bDone = checked.has(b.name) ? 1 : 0;
      return aDone - bDone;
    });
  }, [shopping, checked]);

  const byDay = useMemo(() => {
    const map: Record<
      number,
      { DESAYUNO?: Meal; COMIDA?: Meal; CENA?: Meal }
    > = {};
    for (let d = 0; d < 7; d++) map[d] = {};
    for (const m of meals) {
      map[m.dayOfWeek][m.mealType] = m;
    }
    return map;
  }, [meals]);

  const showBreakfast = useMemo(
    () =>
      (preferenceInitial?.mealsPerWeek ?? 0) >= 18 ||
      meals.some((m) => m.mealType === "DESAYUNO"),
    [meals, preferenceInitial?.mealsPerWeek]
  );
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
    if (!res.ok) {
      setError(data.error ?? "Error al generar");
      setGenerating(false);
      setRegenDay(null);
      return;
    }

    const nextMeals = (data.menu?.meals ?? []) as Meal[];
    setMeals(nextMeals);
    setGenerating(false);
    setRegenDay(null);
    router.refresh();

    const ids = days
      ? nextMeals.filter((m) => days.includes(m.dayOfWeek)).map((m) => m.id)
      : nextMeals.map((m) => m.id);
    void fillImages(ids);
  }

  async function toggleFavorite(id: string) {
    const res = await fetch(`/api/menus/meals/${id}/favorite`, {
      method: "PATCH",
    });
    if (!res.ok) return;
    const data = await res.json();
    setMeals((prev) =>
      prev.map((m) =>
        m.id === id ? { ...m, isFavorite: data.meal.isFavorite } : m
      )
    );
    if (selected?.kind === "meal" && selected.id === id) {
      setSelected({ ...selected, isFavorite: data.meal.isFavorite });
    }
    if (tab === "favoritos") void loadRecipes();
  }

  async function loadShopping() {
    const res = await fetch(
      `/api/menus/shopping-list?weekStart=${weekStartIso}`
    );
    const data = await res.json();
    setChecked(loadChecked(weekStartIso));
    setShopping(data.items ?? []);
  }

  function toggleChecked(name: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      saveChecked(weekStartIso, next);
      return next;
    });
  }

  function resetChecked() {
    const next = new Set<string>();
    setChecked(next);
    saveChecked(weekStartIso, next);
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

  async function loadRecipes() {
    setLoadingRecipes(true);
    const res = await fetch("/api/menus/recipes");
    const data = await res.json();
    setRecipes(data.recipes ?? []);
    setLoadingRecipes(false);
  }

  async function generatePhoto(mealId: string) {
    setPhotoLoadingId(mealId);
    setError(null);
    try {
      const res = await fetch("/api/menus/images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mealIds: [mealId],
          limit: 1,
          force: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "No se pudo generar la foto");
        return;
      }
      const hit = data.updated?.[0] as
        | { id: string; imageUrl: string }
        | undefined;
      if (hit) {
        setMeals((prev) =>
          prev.map((m) =>
            m.id === hit.id ? { ...m, imageUrl: hit.imageUrl } : m
          )
        );
        setSelected((prev) =>
          prev && prev.kind === "meal" && prev.id === hit.id
            ? { ...prev, imageUrl: hit.imageUrl }
            : prev
        );
      } else {
        setError("No se pudo generar la foto. Inténtalo de nuevo.");
      }
    } finally {
      setPhotoLoadingId(null);
    }
  }

  async function removeRecipe(id: string) {
    await fetch(`/api/menus/recipes?id=${id}`, { method: "DELETE" });
    setRecipes((prev) => (prev ? prev.filter((r) => r.id !== id) : prev));
    if (selected?.kind === "recipe" && selected.id === id) setSelected(null);
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
          <p className="mt-1 text-sm text-stone-500">
            {meals.length
              ? `${meals.length} platos · ${meals.filter((m) => m.imageUrl).length} con foto`
              : "Genera el menú de la semana"}
            {imaging ? " · generando fotos…" : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={tab === "semana" ? "amber" : "secondary"}
            size="sm"
            onClick={() => {
              setTab("semana");
              setShopping(null);
            }}
          >
            Semana
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setPrefsOpen(true)}
            aria-label="Preferencias"
            title="Preferencias"
            className="px-2.5"
          >
            <SlidersHorizontal className="h-4 w-4" />
          </Button>
          <Button
            variant={tab === "favoritos" ? "amber" : "secondary"}
            size="sm"
            onClick={() => {
              setTab("favoritos");
              setShopping(null);
              void loadRecipes();
            }}
            aria-label="Favoritos"
            title="Favoritos"
            className="px-2.5"
          >
            <BookHeart className="h-4 w-4" />
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setTab("semana");
              void loadShopping();
            }}
            disabled={!meals.length}
            aria-label="Lista compra"
            title="Lista compra"
            className="px-2.5"
          >
            <ShoppingCart className="h-4 w-4" />
          </Button>
          <Button
            variant="amber"
            size="sm"
            loading={generating}
            onClick={() => {
              if (meals.length > 0) {
                setConfirmGenerate(true);
              } else {
                setTab("semana");
                void generate();
              }
            }}
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

      {tab === "semana" && (
        <div className="space-y-4">
          {DAY_LABELS.map((label, day) => {
            const desayuno = byDay[day].DESAYUNO;
            const comida = byDay[day].COMIDA;
            const cena = byDay[day].CENA;
            return (
              <section key={label} className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-lg font-semibold text-stone-900">
                    {label}
                  </h2>
                  <button
                    type="button"
                    title="Regenerar día"
                    disabled={regenDay === day || generating}
                    onClick={() => generate([day])}
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-stone-500 hover:bg-amber-50 hover:text-amber-800 disabled:opacity-50"
                  >
                    <RefreshCw
                      className={cn(
                        "h-3.5 w-3.5",
                        regenDay === day && "animate-spin"
                      )}
                    />
                    Regenerar
                  </button>
                </div>
                <div
                  className={cn(
                    "grid gap-3",
                    showBreakfast ? "sm:grid-cols-3" : "sm:grid-cols-2"
                  )}
                >
                  {showBreakfast && (
                    <MealCard
                      label="Desayuno"
                      meal={desayuno}
                      onOpen={(m) => setSelected({ kind: "meal", ...m })}
                      onFavorite={toggleFavorite}
                      onGeneratePhoto={generatePhoto}
                      photoLoading={
                        !!desayuno && photoLoadingId === desayuno.id
                      }
                    />
                  )}
                  <MealCard
                    label="Comida"
                    meal={comida}
                    onOpen={(m) => setSelected({ kind: "meal", ...m })}
                    onFavorite={toggleFavorite}
                    onGeneratePhoto={generatePhoto}
                    photoLoading={
                      !!comida && photoLoadingId === comida.id
                    }
                  />
                  <MealCard
                    label="Cena"
                    meal={cena}
                    onOpen={(m) => setSelected({ kind: "meal", ...m })}
                    onFavorite={toggleFavorite}
                    onGeneratePhoto={generatePhoto}
                    photoLoading={!!cena && photoLoadingId === cena.id}
                  />
                </div>
              </section>
            );
          })}
        </div>
      )}

      {tab === "favoritos" && (
        <div>
          {loadingRecipes && (
            <p className="text-sm text-stone-400">Cargando favoritos…</p>
          )}
          {!loadingRecipes && recipes && recipes.length === 0 && (
            <p className="rounded-2xl border border-dashed border-stone-200 bg-white/60 px-4 py-10 text-center text-sm text-stone-500">
              Aún no hay favoritos. Marca el corazón en un plato para guardarlo
              aquí.
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            {(recipes ?? []).map((recipe) => (
              <button
                key={recipe.id}
                type="button"
                onClick={() => setSelected({ kind: "recipe", ...recipe })}
                className="overflow-hidden rounded-2xl border border-stone-200/80 bg-white text-left shadow-soft transition hover:border-amber-200"
              >
                <MealPhoto
                  src={recipe.imageUrl}
                  alt={recipe.name}
                  className="aspect-[4/3] w-full"
                />
                <div className="p-3">
                  <p className="font-medium text-stone-900">{recipe.name}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-stone-500">
                    {recipe.description ||
                      DIFFICULTY_LABEL[recipe.difficulty]}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {shopping && tab === "semana" && (
        <ShoppingPanel
          shopping={shopping}
          orderedShopping={orderedShopping}
          shoppingTotals={shoppingTotals}
          checked={checked}
          savingPrice={savingPrice}
          onClose={() => setShopping(null)}
          onReset={resetChecked}
          onToggle={toggleChecked}
          onSavePrice={savePrice}
          setShopping={setShopping}
        />
      )}

      {prefsOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-stone-900/45 sm:items-center sm:p-4"
          onClick={() => setPrefsOpen(false)}
        >
          <div
            className="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-xl sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-stone-100 px-5 py-4">
              <div>
                <h2 className="font-display text-xl font-semibold text-stone-900">
                  Mis preferencias
                </h2>
                <p className="text-sm text-stone-500">
                  Guía a la IA · se combina con el resto del hogar
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPrefsOpen(false)}
                className="rounded-full p-2 text-stone-500 hover:bg-stone-100"
                aria-label="Cerrar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="overflow-y-auto px-5 py-5">
              <PreferencesForm
                initial={preferenceInitial}
                onSaved={() => setPrefsOpen(false)}
              />
            </div>
          </div>
        </div>
      )}

      {selected && (
        <RecipeSheet
          item={selected}
          onClose={() => setSelected(null)}
          onFavorite={
            selected.kind === "meal"
              ? () => toggleFavorite(selected.id)
              : undefined
          }
          onRemoveRecipe={
            selected.kind === "recipe"
              ? () => removeRecipe(selected.id)
              : undefined
          }
          onGeneratePhoto={
            selected.kind === "meal"
              ? () => generatePhoto(selected.id)
              : undefined
          }
          photoLoading={
            selected.kind === "meal" && photoLoadingId === selected.id
          }
        />
      )}

      {confirmGenerate && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-stone-900/45 p-4 sm:items-center"
          onClick={() => setConfirmGenerate(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-xl font-semibold text-stone-900">
              ¿Generar menú nuevo?
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-stone-600">
              Se sobrescribirá el menú de esta semana (comidas, cenas y fotos).
              Los favoritos de la biblioteca no se pierden.
            </p>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                variant="secondary"
                onClick={() => setConfirmGenerate(false)}
              >
                Cancelar
              </Button>
              <Button
                variant="amber"
                loading={generating}
                onClick={() => {
                  setConfirmGenerate(false);
                  setTab("semana");
                  void generate();
                }}
              >
                <Sparkles className="h-4 w-4" />
                Sí, generar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MealPhoto({
  src,
  alt,
  className,
  onGenerate,
  generating,
}: {
  src?: string | null;
  alt: string;
  className?: string;
  onGenerate?: () => void;
  generating?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden bg-gradient-to-br from-amber-100 via-stone-100 to-teal-50",
        className
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-3">
          <span className="text-xs font-medium uppercase tracking-wider text-amber-700/50">
            Sin foto
          </span>
          {onGenerate && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onGenerate();
              }}
              disabled={generating}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-xs font-medium text-amber-900 shadow-sm ring-1 ring-amber-200/80 transition hover:bg-white disabled:opacity-60"
            >
              <ImagePlus
                className={cn("h-3.5 w-3.5", generating && "animate-pulse")}
              />
              {generating ? "Generando…" : "Generar foto"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function MealCard({
  label,
  meal,
  onOpen,
  onFavorite,
  onGeneratePhoto,
  photoLoading,
}: {
  label: string;
  meal?: Meal;
  onOpen: (m: Meal) => void;
  onFavorite: (id: string) => void;
  onGeneratePhoto: (id: string) => void;
  photoLoading?: boolean;
}) {
  if (!meal) {
    return (
      <div className="overflow-hidden rounded-2xl border border-dashed border-stone-200 bg-stone-50/80">
        <div className="aspect-[4/3] bg-stone-100" />
        <div className="p-3">
          <p className="text-[10px] uppercase tracking-wide text-stone-400">
            {label}
          </p>
          <p className="text-sm text-stone-300">Sin plato</p>
        </div>
      </div>
    );
  }

  const mins = meal.estimatedMins;
  const difficulty = meal.difficulty ?? "MEDIA";
  const missingPhoto = !meal.imageUrl;

  return (
    <div className="group overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-soft">
      <div className="relative">
        <button
          type="button"
          onClick={() => onOpen(meal)}
          className="block w-full text-left"
        >
          <MealPhoto
            src={meal.imageUrl}
            alt={meal.name}
            className="aspect-[4/3] w-full"
            onGenerate={
              missingPhoto ? () => onGeneratePhoto(meal.id) : undefined
            }
            generating={photoLoading}
          />
        </button>
      </div>
      <div className="flex items-start gap-2 p-3">
        <button
          type="button"
          onClick={() => onOpen(meal)}
          className="min-w-0 flex-1 text-left"
        >
          <p className="text-[10px] uppercase tracking-wide text-amber-700/70">
            {label}
          </p>
          <p className="font-medium text-stone-900">{meal.name}</p>
          <p className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-stone-500">
            <span>{DIFFICULTY_LABEL[difficulty]}</span>
            {mins != null && <span>· {mins} min</span>}
            {meal.servings != null && <span>· {meal.servings} raciones</span>}
          </p>
        </button>
        <div className="flex shrink-0 flex-col gap-1">
          {missingPhoto && (
            <button
              type="button"
              onClick={() => onGeneratePhoto(meal.id)}
              disabled={photoLoading}
              className="rounded-lg p-1.5 text-amber-700 hover:bg-amber-50 disabled:opacity-50"
              aria-label="Generar foto"
              title="Generar foto"
            >
              <ImagePlus
                className={cn("h-4 w-4", photoLoading && "animate-pulse")}
              />
            </button>
          )}
          <button
            type="button"
            onClick={() => onFavorite(meal.id)}
            className="rounded-lg p-1.5 hover:bg-amber-50"
            aria-label="Favorito"
          >
            <Heart
              className={cn(
                "h-4 w-4",
                meal.isFavorite
                  ? "fill-amber-500 text-amber-500"
                  : "text-stone-300"
              )}
            />
          </button>
        </div>
      </div>
    </div>
  );
}

function RecipeSheet({
  item,
  onClose,
  onFavorite,
  onRemoveRecipe,
  onGeneratePhoto,
  photoLoading,
}: {
  item: DetailItem;
  onClose: () => void;
  onFavorite?: () => void;
  onRemoveRecipe?: () => void;
  onGeneratePhoto?: () => void;
  photoLoading?: boolean;
}) {
  const difficulty = item.difficulty ?? "MEDIA";
  const mins = item.estimatedMins;
  const ingredients = Array.isArray(item.ingredients) ? item.ingredients : [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-stone-900/45 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white shadow-xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative shrink-0">
          <MealPhoto
            src={item.imageUrl}
            alt={item.name}
            className="aspect-[16/10] w-full"
            onGenerate={
              !item.imageUrl && onGeneratePhoto ? onGeneratePhoto : undefined
            }
            generating={photoLoading}
          />
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 rounded-full bg-white/90 p-2 text-stone-700 shadow"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 pb-8 pt-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-display text-2xl font-semibold text-stone-900">
                {item.name}
              </h3>
              {item.description && (
                <p className="mt-2 text-sm leading-relaxed text-stone-600">
                  {item.description}
                </p>
              )}
            </div>
            {item.kind === "meal" && onFavorite && (
              <button
                type="button"
                onClick={onFavorite}
                className="shrink-0 rounded-xl p-2 hover:bg-amber-50"
              >
                <Heart
                  className={cn(
                    "h-5 w-5",
                    item.isFavorite
                      ? "fill-amber-500 text-amber-500"
                      : "text-stone-300"
                  )}
                />
              </button>
            )}
          </div>

          <div className="mt-4 flex flex-wrap gap-3 text-xs text-stone-600">
            <span className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2.5 py-1.5 font-medium text-amber-800">
              {DIFFICULTY_LABEL[difficulty]}
            </span>
            {mins != null && (
              <span className="inline-flex items-center gap-1 rounded-lg bg-stone-100 px-2.5 py-1.5">
                <Clock className="h-3.5 w-3.5" />
                {mins} min
              </span>
            )}
            {item.servings != null && (
              <span className="inline-flex items-center gap-1 rounded-lg bg-stone-100 px-2.5 py-1.5">
                <Users className="h-3.5 w-3.5" />
                {item.servings} raciones
              </span>
            )}
          </div>

          {(item.tags?.length ?? 0) > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {item.tags!.map((t) => (
                <span
                  key={t}
                  className="rounded-md bg-teal-50 px-2 py-0.5 text-[11px] text-teal-800"
                >
                  {t}
                </span>
              ))}
            </div>
          )}

          <h4 className="mt-6 text-sm font-semibold text-stone-800">
            Ingredientes
          </h4>
          <ul className="mt-2 space-y-1.5 text-sm text-stone-600">
            {ingredients.map((ing, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-amber-500" />
                <span>{formatIngredient(ing)}</span>
              </li>
            ))}
          </ul>

          <h4 className="mt-6 text-sm font-semibold text-stone-800">Pasos</h4>
          <ol className="mt-2 space-y-3">
            {item.steps.map((s, i) => (
              <li key={i} className="flex gap-3 text-sm text-stone-700">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-navy text-[11px] font-semibold text-white">
                  {i + 1}
                </span>
                <span className="pt-0.5 leading-relaxed">{s}</span>
              </li>
            ))}
          </ol>

          {item.kind === "recipe" && onRemoveRecipe && (
            <Button
              className="mt-6 w-full"
              variant="secondary"
              onClick={onRemoveRecipe}
            >
              Quitar de favoritos
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function ShoppingPanel({
  shopping,
  orderedShopping,
  shoppingTotals,
  checked,
  savingPrice,
  onClose,
  onReset,
  onToggle,
  onSavePrice,
  setShopping,
}: {
  shopping: ShoppingItem[];
  orderedShopping: ShoppingItem[];
  shoppingTotals: { estimatedTotal: number; pricedCount: number; done: number };
  checked: Set<string>;
  savingPrice: string | null;
  onClose: () => void;
  onReset: () => void;
  onToggle: (name: string) => void;
  onSavePrice: (name: string, unitPrice: number) => void;
  setShopping: React.Dispatch<React.SetStateAction<ShoppingItem[] | null>>;
}) {
  return (
    <section className="rounded-2xl border border-amber-100 bg-amber-50/50 p-5">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="font-display text-lg font-semibold text-stone-900">
            Lista de la compra
          </h2>
          <p className="text-xs text-stone-500">
            Toca para marcar · se guarda en este móvil
          </p>
        </div>
        <div className="flex items-center gap-3">
          {shoppingTotals.done > 0 && (
            <button
              type="button"
              className="text-sm text-stone-500 underline"
              onClick={onReset}
            >
              Reiniciar
            </button>
          )}
          <button
            type="button"
            className="text-sm text-stone-500 underline"
            onClick={onClose}
          >
            Cerrar
          </button>
        </div>
      </div>

      {shopping.length === 0 ? (
        <p className="text-sm text-stone-500">Sin ingredientes</p>
      ) : (
        <>
          <div className="mb-3 flex items-center justify-between rounded-xl bg-white/70 px-3 py-2 text-sm">
            <span className="font-medium text-stone-800">
              {shoppingTotals.done}/{shopping.length} en el carro
            </span>
            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-stone-200">
              <div
                className="h-full rounded-full bg-teal transition-all"
                style={{
                  width: `${
                    shopping.length
                      ? (shoppingTotals.done / shopping.length) * 100
                      : 0
                  }%`,
                }}
              />
            </div>
          </div>

          <ul className="space-y-2">
            {orderedShopping.map((item) => {
              const done = checked.has(item.name);
              return (
                <li
                  key={item.name}
                  className={cn(
                    "flex items-center gap-3 rounded-xl bg-white/80 px-3 py-3 text-sm text-stone-700",
                    done && "opacity-55"
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onToggle(item.name)}
                    aria-pressed={done}
                    className={cn(
                      "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 transition",
                      done
                        ? "border-teal bg-teal text-white"
                        : "border-stone-300 bg-white text-transparent active:border-teal"
                    )}
                  >
                    <Check className="h-5 w-5" strokeWidth={3} />
                  </button>

                  <button
                    type="button"
                    onClick={() => onToggle(item.name)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p
                      className={cn(
                        "font-medium text-stone-900",
                        done && "line-through decoration-stone-400"
                      )}
                    >
                      {item.name}
                    </p>
                    <p className="text-xs text-stone-400">
                      {item.totalQty
                        ? item.totalQty
                        : item.quantities.length > 0
                          ? item.quantities.join(" + ")
                          : item.count > 1
                            ? `×${item.count}`
                            : "—"}
                    </p>
                  </button>

                  <div className="flex shrink-0 items-center gap-1">
                    <span className="text-xs text-stone-400">€</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step={0.1}
                      className="h-9 w-16 rounded-lg border border-stone-200 bg-white px-2 text-right text-sm"
                      value={item.unitPrice ?? ""}
                      placeholder="—"
                      disabled={savingPrice === item.name}
                      onChange={(e) => {
                        const raw = e.target.value;
                        const value = raw === "" ? null : parseFloat(raw);
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
                          void onSavePrice(item.name, value);
                        }
                      }}
                    />
                  </div>
                </li>
              );
            })}
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
  );
}
