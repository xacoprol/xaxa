"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Clock,
  Heart,
  ImagePlus,
  Loader2,
  Receipt,
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
import { DAY_LABELS, mondayBasedDayIndex } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { estimateLineCost } from "@/lib/menus/aggregate-quantities";

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
  /** false = falta cargar ingredientes/pasos */
  detailLoaded?: boolean;
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
  /** Precio de catálogo (€/kg, €/l o €/ud) */
  unitPrice: number | null;
  priceUnit?: "kg" | "l" | "ud";
  /** Estimación prorrateada para la cantidad de esta semana */
  lineEstimate?: number | null;
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

/** Convierte cualquier imagen (incl. HEIC en Safari) a JPEG para Vision. */
async function imageFileToJpeg(file: File): Promise<File> {
  const type = (file.type || "").toLowerCase();
  if (
    type === "image/jpeg" ||
    type === "image/jpg" ||
    type === "image/png" ||
    type === "image/webp"
  ) {
    if (file.size <= 4 * 1024 * 1024) return file;
  }

  const bitmap = await createImageBitmap(file);
  const maxSide = 2000;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("No se pudo procesar la imagen");
  }
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("No se pudo convertir a JPG"))),
      "image/jpeg",
      0.88
    );
  });

  const base = file.name.replace(/\.[^.]+$/, "") || "ticket";
  return new File([blob], `${base}.jpg`, { type: "image/jpeg" });
}

function formatPriceInput(n: number): string {
  return n.toLocaleString("es-ES", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
    useGrouping: false,
  });
}

/** Acepta "4,50" / "4.50" / "4," mientras se escribe. */
function parsePriceInput(raw: string): number | null {
  const cleaned = raw.trim().replace(/\s/g, "").replace(",", ".");
  if (cleaned === "" || cleaned === ".") return null;
  if (!/^\d*\.?\d*$/.test(cleaned)) return null;
  const n = Number.parseFloat(cleaned);
  if (Number.isNaN(n) || n < 0) return null;
  return Math.round(n * 100) / 100;
}

function sanitizePriceTyping(raw: string): string {
  // Solo dígitos y una coma o punto decimal
  const s = raw.replace(/[^\d.,]/g, "");
  const sep = s.search(/[.,]/);
  if (sep === -1) return s;
  const head = s.slice(0, sep + 1).replace(/\./g, ",");
  const tail = s.slice(sep + 1).replace(/[.,]/g, "");
  return head + tail;
}

type TicketReviewItem = {
  name: string;
  suggestedPrice: number;
  priceInput: string;
  priceUnit: "kg" | "l" | "ud";
  ticketNote: string | null;
  selected: boolean;
};

type TicketReview = {
  store: string | null;
  date: string | null;
  totalPaid: number | null;
  items: TicketReviewItem[];
};

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
  const [meals, setMeals] = useState<Meal[]>(initialMeals);
  const [generating, setGenerating] = useState(false);
  const [imaging, setImaging] = useState(false);
  const [regenDay, setRegenDay] = useState<number | null>(null);
  const [shoppingOpen, setShoppingOpen] = useState(false);
  const [shopping, setShopping] = useState<ShoppingItem[] | null>(null);
  const [shoppingLoading, setShoppingLoading] = useState(false);
  const shoppingWeekRef = useRef<string | null>(null);
  const shoppingFetchIdRef = useRef(0);
  const [checked, setChecked] = useState<Set<string>>(() => new Set());
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<DetailItem | null>(null);
  const [savingPrice, setSavingPrice] = useState<string | null>(null);
  const [tab, setTab] = useState<"semana" | "favoritos">("semana");
  const [recipes, setRecipes] = useState<Recipe[] | null>(null);
  const [loadingRecipes, setLoadingRecipes] = useState(false);
  const [confirmGenerate, setConfirmGenerate] = useState(false);
  const [confirmReplace, setConfirmReplace] = useState<Meal | null>(null);
  const [regenMealId, setRegenMealId] = useState<string | null>(null);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [photoLoadingId, setPhotoLoadingId] = useState<string | null>(null);
  const [ticketReview, setTicketReview] = useState<TicketReview | null>(null);
  const [ticketLoading, setTicketLoading] = useState(false);
  const [ticketSaving, setTicketSaving] = useState(false);
  const ticketInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMeals(initialMeals);
  }, [initialMeals]);

  useEffect(() => {
    setChecked(loadChecked(weekStartIso));
    setShopping(null);
    shoppingWeekRef.current = null;
    setShoppingOpen(false);
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
      }
    },
    []
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
    const priced = shopping.filter((i) => i.lineEstimate != null);
    const estimatedTotal =
      Math.round(priced.reduce((s, i) => s + (i.lineEstimate ?? 0), 0) * 100) /
      100;
    const done = shopping.filter((i) => checked.has(i.name)).length;
    return { estimatedTotal, pricedCount: priced.length, done };
  }, [shopping, checked]);

  const shoppingComplete =
    !!shopping &&
    shopping.length > 0 &&
    shoppingTotals.done === shopping.length;

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

  // Hoy primero; días pasados al final (se recalcula al montar / cambiar semana)
  const todayDay = mondayBasedDayIndex(new Date());
  const dayOrder = useMemo(
    () => Array.from({ length: 7 }, (_, i) => (todayDay + i) % 7),
    // weekStartIso: al pasar de semana conviene reordenar
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [weekStartIso, todayDay]
  );

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

    const nextMeals = ((data.menu?.meals ?? []) as Meal[]).map((m) => ({
      ...m,
      detailLoaded: true,
    }));
    setMeals(nextMeals);
    setGenerating(false);
    setRegenDay(null);

    const ids = days
      ? nextMeals.filter((m) => days.includes(m.dayOfWeek)).map((m) => m.id)
      : nextMeals.map((m) => m.id);
    void fillImages(ids);
  }

  async function replaceMeal(meal: Meal) {
    setError(null);
    setRegenMealId(meal.id);
    setConfirmReplace(null);

    const res = await fetch("/api/menus/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weekStart: weekStartIso, mealId: meal.id }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Error al sustituir el plato");
      setRegenMealId(null);
      return;
    }

    const nextMeals = ((data.menu?.meals ?? []) as Meal[]).map((m) => ({
      ...m,
      detailLoaded: true,
    }));
    setMeals(nextMeals);
    setRegenMealId(null);

    const replacement = nextMeals.find(
      (m) =>
        m.dayOfWeek === meal.dayOfWeek && m.mealType === meal.mealType
    );
    if (replacement) {
      setSelected({ kind: "meal", ...replacement });
    } else {
      setSelected(null);
    }

    if (replacement) void fillImages([replacement.id]);
  }

  async function openMeal(meal: Meal) {
    if (meal.detailLoaded !== false && (meal.steps?.length ?? 0) > 0) {
      setSelected({ kind: "meal", ...meal });
      return;
    }

    setSelected({ kind: "meal", ...meal });
    try {
      const res = await fetch(`/api/menus/meals/${meal.id}`);
      const data = await res.json();
      if (!res.ok || !data.meal) return;
      const full = { ...data.meal, detailLoaded: true } as Meal;
      setMeals((prev) => prev.map((m) => (m.id === full.id ? { ...m, ...full } : m)));
      setSelected((prev) =>
        prev?.kind === "meal" && prev.id === full.id
          ? { kind: "meal", ...full }
          : prev
      );
    } catch {
      // Se queda con lo que haya en tarjeta
    }
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

  async function loadShopping(opts?: { silent?: boolean }) {
    const fetchId = ++shoppingFetchIdRef.current;
    if (!opts?.silent) setShoppingLoading(true);
    try {
      const res = await fetch(
        `/api/menus/shopping-list?weekStart=${weekStartIso}`
      );
      const data = await res.json();
      if (fetchId !== shoppingFetchIdRef.current) return;
      if (!res.ok) return;
      setChecked(loadChecked(weekStartIso));
      setShopping(data.items ?? []);
      shoppingWeekRef.current = weekStartIso;
    } finally {
      if (fetchId === shoppingFetchIdRef.current) {
        setShoppingLoading(false);
      }
    }
  }

  function openShopping() {
    setTab("semana");
    setShoppingOpen(true);
    const hasCache =
      shopping != null && shoppingWeekRef.current === weekStartIso;
    if (!hasCache) setChecked(loadChecked(weekStartIso));
    void loadShopping({ silent: hasCache });
  }

  // Precarga en idle para que al abrir suela estar lista
  useEffect(() => {
    if (!meals.length) return;
    if (shoppingWeekRef.current === weekStartIso && shopping != null) return;
    const run = () => void loadShopping({ silent: true });
    const ric = (
      window as Window & {
        requestIdleCallback?: (
          cb: () => void,
          opts?: { timeout: number }
        ) => number;
        cancelIdleCallback?: (id: number) => void;
      }
    ).requestIdleCallback;
    if (ric) {
      const id = ric(run, { timeout: 1200 });
      return () =>
        (
          window as Window & { cancelIdleCallback?: (id: number) => void }
        ).cancelIdleCallback?.(id);
    }
    const t = window.setTimeout(run, 350);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStartIso, meals.length]);

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

  async function savePrice(
    name: string,
    unitPrice: number,
    priceUnit: "kg" | "l" | "ud" = "ud"
  ) {
    setSavingPrice(name);
    const res = await fetch("/api/menus/ingredient-prices", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, unitPrice, priceUnit }),
    });
    setSavingPrice(null);
    if (!res.ok) return;

    setShopping((prev) =>
      prev
        ? prev.map((item) => {
            if (item.name !== name) return item;
            return {
              ...item,
              unitPrice,
              priceUnit,
              source: "saved" as const,
              lineEstimate: estimateLineCost({
                quantities: item.quantities,
                totalQty: item.totalQty ?? null,
                unitPrice,
                priceUnit,
                name: item.name,
              }),
            };
          })
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

  async function onTicketFile(file: File | null) {
    if (!file) return;
    setTicketLoading(true);
    setError(null);
    try {
      let upload = file;
      try {
        upload = await imageFileToJpeg(file);
      } catch {
        // Si no se puede convertir (HEIC en algunos navegadores), subimos original
        upload = file;
      }
      const form = new FormData();
      form.append("file", upload);
      const res = await fetch("/api/menus/ticket-prices", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "No se pudo leer el ticket");
        return;
      }
      const items = (data.ticket?.items ?? []) as {
        name: string;
        suggestedPrice: number;
        priceUnit?: "kg" | "l" | "ud";
        ticketNote?: string | null;
      }[];
      if (!items.length) {
        setError("No encontré productos con precio en el ticket");
        return;
      }
      setTicketReview({
        store: data.ticket.store ?? null,
        date: data.ticket.date ?? null,
        totalPaid: data.ticket.totalPaid ?? null,
        items: items.map((i) => ({
          name: i.name,
          suggestedPrice: i.suggestedPrice,
          priceInput: formatPriceInput(i.suggestedPrice),
          priceUnit:
            i.priceUnit === "kg" || i.priceUnit === "l" ? i.priceUnit : "ud",
          ticketNote: i.ticketNote ?? null,
          selected: true,
        })),
      });
    } catch {
      setError("No se pudo leer el ticket. Prueba con otra foto más nítida.");
    } finally {
      setTicketLoading(false);
      if (ticketInputRef.current) ticketInputRef.current.value = "";
    }
  }

  async function saveTicketPrices() {
    if (!ticketReview) return;
    const items = ticketReview.items
      .filter((i) => i.selected && i.name.trim().length >= 2)
      .map((i) => {
        const parsed = parsePriceInput(i.priceInput);
        return {
          name: i.name.trim(),
          unitPrice: parsed ?? i.suggestedPrice,
          priceUnit: i.priceUnit,
        };
      })
      .filter((i) => i.unitPrice > 0);
    if (!items.length) {
      setError("Selecciona al menos un producto");
      return;
    }
    setTicketSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/menus/ticket-prices", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "No se pudieron guardar los precios");
        return;
      }

      // Actualiza lista abierta si coincide el nombre
      setShopping((prev) => {
        if (!prev) return prev;
        const map = new Map(
          items.map((i) => [
            i.name.toLowerCase(),
            { unitPrice: i.unitPrice, priceUnit: i.priceUnit },
          ])
        );
        return prev.map((row) => {
          const hit = map.get(row.name.toLowerCase());
          if (!hit) return row;
          return {
            ...row,
            unitPrice: hit.unitPrice,
            priceUnit: hit.priceUnit,
            source: "saved" as const,
            lineEstimate: estimateLineCost({
              quantities: row.quantities,
              totalQty: row.totalQty ?? null,
              unitPrice: hit.unitPrice,
              priceUnit: hit.priceUnit,
              name: row.name,
            }),
          };
        });
      });

      setTicketReview(null);
    } finally {
      setTicketSaving(false);
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
              setShoppingOpen(false);
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
              setShoppingOpen(false);
              void loadRecipes();
            }}
            aria-label="Favoritos"
            title="Favoritos"
            className="px-2.5"
          >
            <BookHeart className="h-4 w-4" />
          </Button>
          <Button
            variant={shoppingOpen ? "amber" : "secondary"}
            size="sm"
            onClick={openShopping}
            disabled={!meals.length}
            aria-label={
              shoppingComplete ? "Lista compra hecha" : "Lista compra"
            }
            title={
              shoppingComplete ? "Lista de la compra hecha" : "Lista compra"
            }
            className="relative px-2.5"
          >
            <ShoppingCart className="h-4 w-4" />
            {shoppingComplete && (
              <span
                className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-teal text-white ring-2 ring-white"
                aria-hidden
              >
                <Check className="h-2.5 w-2.5" strokeWidth={3} />
              </span>
            )}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            loading={ticketLoading}
            onClick={() => ticketInputRef.current?.click()}
            aria-label="Subir ticket Eroski"
            title="Subir ticket para precios"
            className="px-2.5"
          >
            <Receipt className="h-4 w-4" />
          </Button>
          <input
            ref={ticketInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => void onTicketFile(e.target.files?.[0] ?? null)}
          />
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
          {dayOrder.map((day, index) => {
            const label = DAY_LABELS[day];
            const isToday = todayDay === day;
            // Días ya pasados quedan al final, un poco atenuados
            const isPastSection = todayDay > 0 && index >= 7 - todayDay;
            const desayuno = byDay[day].DESAYUNO;
            const comida = byDay[day].COMIDA;
            const cena = byDay[day].CENA;

            return (
              <section
                key={label}
                className={cn("space-y-3", isPastSection && "opacity-55")}
              >
                <div className="flex items-center justify-between">
                  <h2 className="font-display flex items-baseline gap-2 text-lg font-semibold leading-tight text-stone-900">
                    {label}
                    {isToday && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-800">
                        Hoy
                      </span>
                    )}
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
                    // Móvil: carrusel a sangre por la derecha, peek del siguiente
                    "-mr-4 flex items-stretch gap-3 overflow-x-auto scroll-smooth pb-1 pr-4",
                    "snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
                    // Desktop: rejilla normal
                    "sm:mr-0 sm:grid sm:items-stretch sm:gap-3 sm:overflow-visible sm:pb-0 sm:pr-0 sm:snap-none",
                    showBreakfast ? "sm:grid-cols-3" : "sm:grid-cols-2"
                  )}
                >
                  {(
                    [
                      showBreakfast
                        ? {
                            key: "desayuno",
                            label: "Desayuno",
                            meal: desayuno,
                          }
                        : null,
                      { key: "comida", label: "Comida", meal: comida },
                      { key: "cena", label: "Cena", meal: cena },
                    ] as const
                  )
                    .filter(
                      (s): s is NonNullable<typeof s> => s != null
                    )
                    .map((slot) => (
                      <div
                        key={slot.key}
                        className="flex w-[78%] max-w-[17.5rem] shrink-0 snap-start self-stretch sm:w-auto sm:max-w-none sm:shrink"
                      >
                        <MealCard
                          label={slot.label}
                          meal={slot.meal}
                          onOpen={openMeal}
                          onFavorite={toggleFavorite}
                          onReplace={(m) => setConfirmReplace(m)}
                          replaceLoading={
                            !!slot.meal && regenMealId === slot.meal.id
                          }
                          onGeneratePhoto={generatePhoto}
                          photoLoading={
                            !!slot.meal && photoLoadingId === slot.meal.id
                          }
                          disabled={generating || regenMealId != null}
                        />
                      </div>
                    ))}
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

      {shoppingOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-stone-900/45 sm:items-center sm:p-4"
          onClick={() => setShoppingOpen(false)}
        >
          <div
            className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white shadow-xl sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-stone-100 px-5 py-4">
              <div>
                <h2 className="font-display text-xl font-semibold text-stone-900">
                  Lista de la compra
                </h2>
                <p className="text-sm text-stone-500">
                  {shoppingLoading && !shopping
                    ? "Cargando productos…"
                    : "Toca para marcar · ticket Eroski para precios"}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => ticketInputRef.current?.click()}
                  disabled={ticketLoading}
                  className="rounded-full p-2 text-amber-800 hover:bg-amber-50 disabled:opacity-50"
                  aria-label="Subir ticket"
                  title="Subir ticket"
                >
                  <Receipt className="h-4 w-4" />
                </button>
                {shoppingTotals.done > 0 && (
                  <button
                    type="button"
                    onClick={resetChecked}
                    className="rounded-full px-2 py-1 text-xs text-stone-500 hover:bg-stone-100"
                  >
                    Reiniciar
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShoppingOpen(false)}
                  className="rounded-full p-2 text-stone-500 hover:bg-stone-100"
                  aria-label="Cerrar"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="overflow-y-auto px-5 py-4">
              {shoppingLoading && !shopping ? (
                <ShoppingListSkeleton />
              ) : shopping ? (
                <ShoppingPanel
                  shopping={shopping}
                  orderedShopping={orderedShopping}
                  shoppingTotals={shoppingTotals}
                  checked={checked}
                  savingPrice={savingPrice}
                  onToggle={toggleChecked}
                  onSavePrice={savePrice}
                  setShopping={setShopping}
                />
              ) : (
                <p className="text-sm text-stone-500">
                  No se pudo cargar la lista. Cierra y vuelve a abrir.
                </p>
              )}
            </div>
          </div>
        </div>
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

      {ticketReview && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-stone-900/45 sm:items-center sm:p-4"
          onClick={() => !ticketSaving && setTicketReview(null)}
        >
          <div
            className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white shadow-xl sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-stone-100 px-5 py-4">
              <div>
                <h2 className="font-display text-xl font-semibold text-stone-900">
                  Precios del ticket
                </h2>
                <p className="text-sm text-stone-500">
                  {ticketReview.store ?? "Supermercado"}
                  {ticketReview.date ? ` · ${ticketReview.date}` : ""}
                  {ticketReview.totalPaid != null
                    ? ` · total ${ticketReview.totalPaid.toLocaleString("es-ES", {
                        style: "currency",
                        currency: "EUR",
                      })}`
                    : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTicketReview(null)}
                className="rounded-full p-2 text-stone-500 hover:bg-stone-100"
                aria-label="Cerrar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="overflow-y-auto px-5 py-4">
              <p className="mb-3 text-xs text-stone-500">
                Revisa y corrige si hace falta. Al peso se guarda{" "}
                <span className="font-medium text-stone-700">€/kg</span>, en
                líquidos <span className="font-medium text-stone-700">€/l</span>{" "}
                — no el total de la línea.
              </p>
              <ul className="space-y-2">
                {ticketReview.items.map((item, idx) => (
                  <li
                    key={`ticket-item-${idx}`}
                    className="rounded-xl border border-stone-100 bg-stone-50/80 px-3 py-2.5"
                  >
                    <div className="flex items-start gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          setTicketReview((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  items: prev.items.map((row, i) =>
                                    i === idx
                                      ? { ...row, selected: !row.selected }
                                      : row
                                  ),
                                }
                              : prev
                          )
                        }
                        className={cn(
                          "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border-2",
                          item.selected
                            ? "border-teal bg-teal text-white"
                            : "border-stone-300 bg-white text-transparent"
                        )}
                        aria-pressed={item.selected}
                      >
                        <Check className="h-4 w-4" strokeWidth={3} />
                      </button>
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <input
                          type="text"
                          className="h-9 w-full rounded-lg border border-stone-200 bg-white px-2.5 text-sm font-medium text-stone-900"
                          value={item.name}
                          onChange={(e) => {
                            const name = e.target.value;
                            setTicketReview((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    items: prev.items.map((row, i) =>
                                      i === idx ? { ...row, name } : row
                                    ),
                                  }
                                : prev
                            );
                          }}
                        />
                        {item.ticketNote && (
                          <p className="text-[11px] text-stone-400">
                            {item.ticketNote}
                          </p>
                        )}
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            inputMode="decimal"
                            autoComplete="off"
                            className="h-9 w-24 rounded-lg border border-stone-200 bg-white px-2 text-right text-sm"
                            value={item.priceInput}
                            onChange={(e) => {
                              const priceInput = sanitizePriceTyping(
                                e.target.value
                              );
                              const parsed = parsePriceInput(priceInput);
                              setTicketReview((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      items: prev.items.map((row, i) =>
                                        i === idx
                                          ? {
                                              ...row,
                                              priceInput,
                                              suggestedPrice:
                                                parsed ?? row.suggestedPrice,
                                            }
                                          : row
                                      ),
                                    }
                                  : prev
                              );
                            }}
                            onBlur={() => {
                              const parsed = parsePriceInput(item.priceInput);
                              if (parsed == null) return;
                              setTicketReview((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      items: prev.items.map((row, i) =>
                                        i === idx
                                          ? {
                                              ...row,
                                              suggestedPrice: parsed,
                                              priceInput:
                                                formatPriceInput(parsed),
                                            }
                                          : row
                                      ),
                                    }
                                  : prev
                              );
                            }}
                          />
                          <select
                            className="h-9 rounded-lg border border-stone-200 bg-white px-2 text-xs font-medium text-stone-600"
                            value={item.priceUnit}
                            onChange={(e) => {
                              const priceUnit = e.target.value as
                                | "kg"
                                | "l"
                                | "ud";
                              setTicketReview((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      items: prev.items.map((row, i) =>
                                        i === idx ? { ...row, priceUnit } : row
                                      ),
                                    }
                                  : prev
                              );
                            }}
                          >
                            <option value="kg">€/kg</option>
                            <option value="l">€/l</option>
                            <option value="ud">€/ud</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex gap-2 border-t border-stone-100 px-5 py-4">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => setTicketReview(null)}
                disabled={ticketSaving}
              >
                Cancelar
              </Button>
              <Button
                variant="amber"
                className="flex-1"
                loading={ticketSaving}
                onClick={() => void saveTicketPrices()}
              >
                Guardar precios
              </Button>
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
          onReplace={
            selected.kind === "meal"
              ? () => setConfirmReplace(selected)
              : undefined
          }
          replaceLoading={
            selected.kind === "meal" && regenMealId === selected.id
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

      {confirmReplace && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-stone-900/45 p-4 sm:items-center"
          onClick={() => !regenMealId && setConfirmReplace(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-xl font-semibold text-stone-900">
              ¿Sustituir este plato?
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-stone-600">
              Se sustituirá «{confirmReplace.name}» por otro nuevo (incluida la
              foto). El resto del menú no cambia.
            </p>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                variant="secondary"
                disabled={!!regenMealId}
                onClick={() => setConfirmReplace(null)}
              >
                Cancelar
              </Button>
              <Button
                variant="amber"
                loading={regenMealId === confirmReplace.id}
                onClick={() => void replaceMeal(confirmReplace)}
              >
                <RefreshCw className="h-4 w-4" />
                Sí, sustituir
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
  onReplace,
  replaceLoading,
  onGeneratePhoto,
  photoLoading,
  disabled,
}: {
  label: string;
  meal?: Meal;
  onOpen: (m: Meal) => void;
  onFavorite: (id: string) => void;
  onReplace: (m: Meal) => void;
  replaceLoading?: boolean;
  onGeneratePhoto: (id: string) => void;
  photoLoading?: boolean;
  disabled?: boolean;
}) {
  if (!meal) {
    return (
      <div className="flex h-full min-h-full w-full flex-col overflow-hidden rounded-2xl border border-dashed border-stone-200 bg-stone-50/80">
        <div className="aspect-[4/3] shrink-0 bg-stone-100" />
        <div className="flex flex-1 flex-col justify-between gap-2 p-3">
          <div>
            <p className="text-[10px] uppercase leading-none tracking-wide text-stone-400">
              {label}
            </p>
            <p className="mt-1 h-10 text-sm leading-snug text-stone-300">
              Sin plato
            </p>
          </div>
          <p className="h-4 text-xs text-transparent">·</p>
        </div>
      </div>
    );
  }

  const mins = meal.estimatedMins;
  const difficulty = meal.difficulty ?? "MEDIA";
  const missingPhoto = !meal.imageUrl;

  return (
    <div className="group flex h-full min-h-full w-full flex-col overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-soft">
      <div className="relative shrink-0">
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
      <div className="flex flex-1 items-stretch gap-2 p-3">
        <button
          type="button"
          onClick={() => onOpen(meal)}
          className="flex min-w-0 flex-1 flex-col text-left"
        >
          <p className="text-[10px] uppercase leading-none tracking-wide text-amber-700/70">
            {label}
          </p>
          <p className="mt-1 line-clamp-2 h-10 font-medium leading-snug text-stone-900">
            {meal.name}
          </p>
          <p className="mt-auto flex flex-wrap gap-x-2 gap-y-0.5 pt-1 text-xs leading-none text-stone-500">
            <span>{DIFFICULTY_LABEL[difficulty]}</span>
            {mins != null && <span>· {mins} min</span>}
            {meal.servings != null && <span>· {meal.servings} raciones</span>}
          </p>
        </button>
        <div className="flex w-8 shrink-0 flex-col items-center justify-start gap-1">
          {missingPhoto ? (
            <button
              type="button"
              onClick={() => onGeneratePhoto(meal.id)}
              disabled={photoLoading || disabled}
              className="rounded-lg p-1.5 text-amber-700 hover:bg-amber-50 disabled:opacity-50"
              aria-label="Generar foto"
              title="Generar foto"
            >
              <ImagePlus
                className={cn("h-4 w-4", photoLoading && "animate-pulse")}
              />
            </button>
          ) : (
            <span className="h-8 w-8" aria-hidden />
          )}
          <button
            type="button"
            onClick={() => onReplace(meal)}
            disabled={disabled || replaceLoading}
            className="rounded-lg p-1.5 text-stone-400 hover:bg-amber-50 hover:text-amber-800 disabled:opacity-50"
            aria-label="Cambiar plato"
            title="Cambiar plato"
          >
            <RefreshCw
              className={cn("h-4 w-4", replaceLoading && "animate-spin")}
            />
          </button>
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
  onReplace,
  replaceLoading,
  onGeneratePhoto,
  photoLoading,
}: {
  item: DetailItem;
  onClose: () => void;
  onFavorite?: () => void;
  onRemoveRecipe?: () => void;
  onReplace?: () => void;
  replaceLoading?: boolean;
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
            <div className="flex shrink-0 gap-1">
              {item.kind === "meal" && onReplace && (
                <button
                  type="button"
                  onClick={onReplace}
                  disabled={replaceLoading}
                  className="rounded-xl p-2 text-stone-500 hover:bg-amber-50 hover:text-amber-800 disabled:opacity-50"
                  aria-label="Cambiar plato"
                  title="Cambiar plato"
                >
                  <RefreshCw
                    className={cn("h-5 w-5", replaceLoading && "animate-spin")}
                  />
                </button>
              )}
              {item.kind === "meal" && onFavorite && (
                <button
                  type="button"
                  onClick={onFavorite}
                  className="rounded-xl p-2 hover:bg-amber-50"
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
          {ingredients.length === 0 && item.kind === "meal" ? (
            <p className="mt-2 text-sm text-stone-400">Cargando receta…</p>
          ) : (
            <ul className="mt-2 space-y-1.5 text-sm text-stone-600">
              {ingredients.map((ing, i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-amber-500" />
                  <span>{formatIngredient(ing)}</span>
                </li>
              ))}
            </ul>
          )}

          <h4 className="mt-6 text-sm font-semibold text-stone-800">Pasos</h4>
          {item.steps.length === 0 && item.kind === "meal" ? (
            <p className="mt-2 text-sm text-stone-400">Cargando pasos…</p>
          ) : (
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
          )}

          {item.kind === "meal" && onReplace && (
            <Button
              className="mt-6 w-full"
              variant="secondary"
              loading={replaceLoading}
              onClick={onReplace}
            >
              <RefreshCw className="h-4 w-4" />
              Cambiar este plato
            </Button>
          )}

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

function ShoppingListSkeleton() {
  return (
    <div className="space-y-3 pb-[env(safe-area-inset-bottom)]" aria-busy>
      <div className="flex items-center gap-2 text-sm text-stone-500">
        <Loader2 className="h-4 w-4 animate-spin text-teal" />
        Preparando productos…
      </div>
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-xl border border-stone-100 bg-stone-50/80 px-3 py-3"
        >
          <div className="h-11 w-11 shrink-0 animate-pulse rounded-xl bg-stone-200/80" />
          <div className="min-w-0 flex-1 space-y-2">
            <div
              className="h-3.5 animate-pulse rounded bg-stone-200/90"
              style={{ width: `${55 + (i % 3) * 12}%` }}
            />
            <div className="h-2.5 w-24 animate-pulse rounded bg-stone-100" />
          </div>
          <div className="h-8 w-16 animate-pulse rounded-lg bg-stone-100" />
        </div>
      ))}
    </div>
  );
}

function ShoppingPanel({
  shopping,
  orderedShopping,
  shoppingTotals,
  checked,
  savingPrice,
  onToggle,
  onSavePrice,
  setShopping,
}: {
  shopping: ShoppingItem[];
  orderedShopping: ShoppingItem[];
  shoppingTotals: { estimatedTotal: number; pricedCount: number; done: number };
  checked: Set<string>;
  savingPrice: string | null;
  onToggle: (name: string) => void;
  onSavePrice: (
    name: string,
    unitPrice: number,
    priceUnit?: "kg" | "l" | "ud"
  ) => void;
  setShopping: React.Dispatch<React.SetStateAction<ShoppingItem[] | null>>;
}) {
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({});

  if (shopping.length === 0) {
    return <p className="text-sm text-stone-500">Sin ingredientes</p>;
  }

  return (
    <div className="space-y-4 pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-between rounded-xl bg-amber-50 px-3 py-2 text-sm">
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
          const priceUnit = item.priceUnit ?? "ud";
          return (
            <li
              key={item.name}
              className={cn(
                "flex items-center gap-3 rounded-xl border border-stone-100 bg-stone-50/80 px-3 py-3 text-sm text-stone-700",
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
                  {item.unitPrice != null && (
                    <span className="text-stone-300">
                      {" "}
                      · {item.unitPrice.toLocaleString("es-ES", {
                        style: "currency",
                        currency: "EUR",
                      })}
                      /{priceUnit}
                    </span>
                  )}
                </p>
              </button>

              <div className="flex shrink-0 flex-col items-end gap-0.5">
                <p className="text-sm font-semibold text-stone-800">
                  {item.lineEstimate != null
                    ? item.lineEstimate.toLocaleString("es-ES", {
                        style: "currency",
                        currency: "EUR",
                      })
                    : "—"}
                </p>
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    title="Precio de catálogo"
                    className="h-8 w-14 rounded-lg border border-stone-200 bg-white px-1.5 text-right text-xs"
                    value={
                      priceDrafts[item.name] ??
                      (item.unitPrice != null
                        ? formatPriceInput(item.unitPrice)
                        : "")
                    }
                    placeholder="—"
                    disabled={savingPrice === item.name}
                    onChange={(e) => {
                      const priceInput = sanitizePriceTyping(e.target.value);
                      setPriceDrafts((d) => ({
                        ...d,
                        [item.name]: priceInput,
                      }));
                      const parsed =
                        priceInput === "" ? null : parsePriceInput(priceInput);
                      setShopping((prev) =>
                        prev
                          ? prev.map((row) => {
                              if (row.name !== item.name) return row;
                              const unitPrice =
                                priceInput === ""
                                  ? null
                                  : (parsed ?? row.unitPrice);
                              const pu = row.priceUnit ?? "ud";
                              return {
                                ...row,
                                unitPrice,
                                lineEstimate:
                                  unitPrice != null
                                    ? estimateLineCost({
                                        quantities: row.quantities,
                                        totalQty: row.totalQty ?? null,
                                        unitPrice,
                                        priceUnit: pu,
                                        name: row.name,
                                      })
                                    : null,
                              };
                            })
                          : prev
                      );
                    }}
                    onBlur={(e) => {
                      const parsed = parsePriceInput(e.target.value);
                      setPriceDrafts((d) => {
                        const next = { ...d };
                        delete next[item.name];
                        return next;
                      });
                      if (parsed != null && parsed >= 0) {
                        void onSavePrice(item.name, parsed, priceUnit);
                      }
                    }}
                  />
                  <select
                    className="h-8 rounded-lg border border-stone-200 bg-white px-1 text-[10px] text-stone-500"
                    value={priceUnit}
                    disabled={savingPrice === item.name}
                    onChange={(e) => {
                      const nextUnit = e.target.value as "kg" | "l" | "ud";
                      setShopping((prev) =>
                        prev
                          ? prev.map((row) => {
                              if (row.name !== item.name) return row;
                              const unitPrice = row.unitPrice;
                              return {
                                ...row,
                                priceUnit: nextUnit,
                                lineEstimate:
                                  unitPrice != null
                                    ? estimateLineCost({
                                        quantities: row.quantities,
                                        totalQty: row.totalQty ?? null,
                                        unitPrice,
                                        priceUnit: nextUnit,
                                        name: row.name,
                                      })
                                    : null,
                              };
                            })
                          : prev
                      );
                      if (item.unitPrice != null) {
                        void onSavePrice(item.name, item.unitPrice, nextUnit);
                      }
                    }}
                  >
                    <option value="kg">/kg</option>
                    <option value="l">/l</option>
                    <option value="ud">/ud</option>
                  </select>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-amber-700/80">
            Total estimado
          </p>
          <p className="text-xs text-stone-400">
            {shoppingTotals.pricedCount}/{shopping.length} con precio · según
            cantidad de la semana
          </p>
        </div>
        <p className="font-display text-2xl font-semibold text-navy">
          {shoppingTotals.estimatedTotal.toLocaleString("es-ES", {
            style: "currency",
            currency: "EUR",
          })}
        </p>
      </div>
    </div>
  );
}
