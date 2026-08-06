export const MODULE_ACCENTS = {
  expenses: {
    name: "Gastos",
    color: "emerald",
    bg: "bg-emerald-500",
    bgSoft: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200",
    ring: "ring-emerald-500",
    hex: "#059669",
  },
  menus: {
    name: "Menús",
    color: "amber",
    bg: "bg-amber-500",
    bgSoft: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200",
    ring: "ring-amber-500",
    hex: "#d97706",
  },
  mortgage: {
    name: "Hipoteca",
    color: "sky",
    bg: "bg-sky-500",
    bgSoft: "bg-sky-50",
    text: "text-sky-700",
    border: "border-sky-200",
    ring: "ring-sky-500",
    hex: "#0284c7",
  },
} as const;

export const DEFAULT_CATEGORIES = [
  { name: "Supermercado", color: "#059669" },
  { name: "Restaurantes", color: "#d97706" },
  { name: "Transporte", color: "#0284c7" },
  { name: "Hogar", color: "#7c3aed" },
  { name: "Ocio", color: "#db2777" },
  { name: "Salud", color: "#dc2626" },
  { name: "Otros", color: "#57534e" },
] as const;

export const DAY_LABELS = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
  "Domingo",
] as const;
