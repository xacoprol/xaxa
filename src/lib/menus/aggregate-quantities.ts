type UnitFamily = "mass" | "volume" | "count";

type ParsedPart = {
  value: number;
  family: UnitFamily;
  /** Canonical base unit: g | ml | ud */
  baseUnit: "g" | "ml" | "ud";
};

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

function parseOne(raw: string): ParsedPart | null {
  const cleaned = raw.trim().replace(",", ".");
  // "200g", "200 g", "0.2 kg", "2"
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

/** Sum compatible quantity strings into one readable total. */
export function aggregateQuantities(quantities: string[]): string | null {
  if (quantities.length === 0) return null;

  const parsed = quantities.map(parseOne);
  if (parsed.some((p) => p == null)) {
    // Can't fully parse — if all look identical strings, still show one
    const unique = Array.from(new Set(quantities.map((q) => q.trim())));
    return unique.length === 1 ? unique[0] : unique.join(" + ");
  }

  const parts = parsed as ParsedPart[];
  const family = parts[0].family;
  if (!parts.every((p) => p.family === family)) {
    return quantities.join(" + ");
  }

  const total = parts.reduce((s, p) => s + p.value, 0);
  if (family === "mass") return formatMass(total);
  if (family === "volume") return formatVolume(total);
  return formatCount(total);
}
