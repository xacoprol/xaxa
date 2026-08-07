type UnitFamily = "mass" | "volume" | "count";

export type ParsedQty = {
  value: number;
  family: UnitFamily;
  /** Canonical base unit: g | ml | ud */
  baseUnit: "g" | "ml" | "ud";
};

export type CatalogPriceUnit = "kg" | "l" | "ud";

const MASS: Record<string, number> = {
  g: 1,
  gr: 1,
  gramo: 1,
  gramos: 1,
  kg: 1000,
  kilo: 1000,
  kilos: 1000,
  kilogramo: 1000,
  kilogramos: 1000,
};

const VOLUME: Record<string, number> = {
  ml: 1,
  mililitro: 1,
  mililitros: 1,
  cl: 10,
  l: 1000,
  lt: 1000,
  litro: 1000,
  litros: 1000,
};

const COUNT: Record<string, number> = {
  ud: 1,
  uds: 1,
  u: 1,
  unidad: 1,
  unidades: 1,
  pieza: 1,
  piezas: 1,
  pc: 1,
  pcs: 1,
};

function normalizeUnit(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\./g, "")
    .trim();
}

export function parseQuantityString(raw: string): ParsedQty | null {
  const cleaned = raw.trim().replace(",", ".");
  const match = cleaned.match(
    /^(\d+(?:\.\d+)?)\s*([a-zA-ZáéíóúüñÁÉÍÓÚÜÑ.]+)?$/
  );
  if (!match) return null;

  const value = parseFloat(match[1]);
  if (Number.isNaN(value)) return null;

  const unitRaw = match[2] ? normalizeUnit(match[2]) : "";
  if (!unitRaw || unitRaw in COUNT) {
    return {
      value: value * (unitRaw ? COUNT[unitRaw] ?? 1 : 1),
      family: "count",
      baseUnit: "ud",
    };
  }
  if (unitRaw in MASS) {
    return { value: value * MASS[unitRaw], family: "mass", baseUnit: "g" };
  }
  if (unitRaw in VOLUME) {
    return {
      value: value * VOLUME[unitRaw],
      family: "volume",
      baseUnit: "ml",
    };
  }
  return null;
}

function formatMass(grams: number): string {
  if (grams >= 1000) {
    const kg = Math.round((grams / 1000) * 100) / 100;
    return `${kg} kg`;
  }
  const g = Math.round(grams * 10) / 10;
  return Number.isInteger(g) ? `${g} g` : `${g} g`;
}

function formatVolume(ml: number): string {
  if (ml >= 1000) {
    const l = Math.round((ml / 1000) * 100) / 100;
    return `${l} l`;
  }
  const v = Math.round(ml * 10) / 10;
  return `${v} ml`;
}

function formatCount(n: number): string {
  const v = Math.round(n * 100) / 100;
  return v === 1 ? "1 ud" : `${v} ud`;
}

/** Suma cantidades compatibles a base (g/ml/ud). */
export function sumQuantities(quantities: string[]): ParsedQty | null {
  if (quantities.length === 0) return null;
  const parsed = quantities.map(parseQuantityString);
  if (parsed.some((p) => p == null)) return null;
  const parts = parsed as ParsedQty[];
  const family = parts[0].family;
  if (!parts.every((p) => p.family === family)) return null;
  const value = parts.reduce((s, p) => s + p.value, 0);
  return { value, family, baseUnit: parts[0].baseUnit };
}

/** Sum compatible quantity strings into one readable total. */
export function aggregateQuantities(quantities: string[]): string | null {
  if (quantities.length === 0) return null;

  const summed = sumQuantities(quantities);
  if (!summed) {
    const unique = Array.from(new Set(quantities.map((q) => q.trim())));
    return unique.length === 1 ? unique[0] : unique.join(" + ");
  }

  if (summed.family === "mass") return formatMass(summed.value);
  if (summed.family === "volume") return formatVolume(summed.value);
  return formatCount(summed.value);
}

const LITER_PACK_HINT =
  /\b(aceite|vinagre|leche|nata|caldo|vino|cerveza|zumo|agua|salsa de soja|soja liquida|soja líquida)\b/i;

/**
 * Estima el coste de la cantidad de esta semana a partir del precio de catálogo.
 * unitPrice es €/kg, €/l o €/ud.
 */
export function estimateLineCost(opts: {
  quantities: string[];
  totalQty: string | null;
  unitPrice: number;
  priceUnit: CatalogPriceUnit;
  name?: string;
}): number | null {
  const { unitPrice, name } = opts;
  if (!(unitPrice > 0)) return null;

  let qty =
    (opts.totalQty ? parseQuantityString(opts.totalQty) : null) ??
    sumQuantities(opts.quantities);

  let priceUnit = opts.priceUnit;

  // Botella/ud de líquido típico (aceite 1 L) + necesidad en ml → tratar como €/l
  if (
    priceUnit === "ud" &&
    qty?.family === "volume" &&
    name &&
    LITER_PACK_HINT.test(name)
  ) {
    priceUnit = "l";
  }

  if (!qty) {
    // Sin cantidad: solo tiene sentido €/ud (1 unidad)
    return priceUnit === "ud" ? Math.round(unitPrice * 100) / 100 : null;
  }

  if (priceUnit === "kg" && qty.family === "mass") {
    return Math.round((qty.value / 1000) * unitPrice * 100) / 100;
  }
  if (priceUnit === "l" && qty.family === "volume") {
    return Math.round((qty.value / 1000) * unitPrice * 100) / 100;
  }
  if (priceUnit === "ud" && qty.family === "count") {
    return Math.round(qty.value * unitPrice * 100) / 100;
  }

  // €/l con masa (raro) o €/kg con volumen: no mezclar
  if (priceUnit === "l" && qty.family === "mass") return null;
  if (priceUnit === "kg" && qty.family === "volume") {
    // Algunos guardan aceite como €/kg por error → tratar como litro
    if (name && LITER_PACK_HINT.test(name)) {
      return Math.round((qty.value / 1000) * unitPrice * 100) / 100;
    }
    return null;
  }

  return null;
}
