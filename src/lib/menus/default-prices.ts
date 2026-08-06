/** Precios medios orientativos (€) para un hogar en España — no son de un súper concreto. */
export const DEFAULT_INGREDIENT_PRICES: Record<string, number> = {
  aceite: 3.5,
  "aceite de oliva": 4.5,
  ajo: 0.8,
  agua: 0.5,
  arroz: 1.8,
  atun: 2.2,
  aguacate: 2.5,
  bacon: 3.2,
  banana: 1.5,
  platano: 1.5,
  basmati: 2.5,
  berenjena: 1.8,
  brócoli: 1.9,
  broccoli: 1.9,
  caballa: 2.5,
  calabacin: 1.6,
  calabacín: 1.6,
  carne: 6.5,
  cebolla: 1.2,
  cerdo: 5.5,
  champiñones: 2.0,
  chocolate: 2.0,
  cilantro: 1.0,
  limon: 1.0,
  limón: 1.0,
  lima: 1.2,
  leche: 1.1,
  lentejas: 1.6,
  maiz: 1.2,
  maíz: 1.2,
  manzana: 2.0,
  mayonesa: 1.8,
  miel: 3.5,
  mostaza: 1.5,
  nata: 1.8,
  nueces: 3.5,
  pan: 1.2,
  pasta: 1.5,
  patata: 2.0,
  patatas: 2.0,
  pepino: 1.4,
  pimenton: 1.5,
  pimentón: 1.5,
  pimiento: 1.8,
  pimientos: 2.2,
  pollo: 5.5,
  "pechuga de pollo": 6.5,
  queso: 2.8,
  "queso fresco": 2.2,
  quinoa: 3.5,
  sal: 0.5,
  salmon: 8.5,
  salmón: 8.5,
  salsa: 1.8,
  soja: 2.0,
  "salsa de soja": 2.0,
  tomate: 2.0,
  tomates: 2.2,
  "tomate frito": 1.5,
  ternera: 9.0,
  tofu: 2.5,
  zanahoria: 1.2,
  zanahorias: 1.4,
  huevo: 0.35,
  huevos: 2.5,
  harina: 1.2,
  yogur: 1.5,
  yogurt: 1.5,
  garbanzos: 1.4,
  judias: 1.5,
  judías: 1.5,
  espinacas: 1.8,
  lechuga: 1.3,
  rucula: 1.5,
  rúcula: 1.5,
  jamon: 4.0,
  jamón: 4.0,
  chorizo: 2.5,
  merluza: 7.5,
  bacalao: 6.5,
  gambas: 7.0,
  langostinos: 8.0,
  "leche de coco": 2.2,
  curry: 2.0,
  jengibre: 1.5,
  "nata liquida": 1.8,
  "nata líquida": 1.8,
  mantequilla: 2.5,
  "crema de leche": 1.8,
  "caldo de pollo": 1.5,
  "caldo de verduras": 1.5,
  vinagre: 1.2,
  azucar: 1.0,
  azúcar: 1.0,
  canela: 1.5,
  orégano: 1.2,
  oregano: 1.2,
  perejil: 0.9,
  albahaca: 1.2,
  "pan rallado": 1.3,
  "queso rallado": 2.5,
  mozzarella: 2.8,
  parmesano: 3.5,
  ricotta: 2.5,
  "pasta integral": 1.8,
  "arroz integral": 2.2,
};

export function normalizeIngredientKey(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

export function lookupDefaultPrice(name: string): number | null {
  const key = normalizeIngredientKey(name);
  if (DEFAULT_INGREDIENT_PRICES[key] != null) {
    return DEFAULT_INGREDIENT_PRICES[key];
  }
  // match parcial: si el nombre contiene una clave conocida
  for (const [k, price] of Object.entries(DEFAULT_INGREDIENT_PRICES)) {
    if (key.includes(k) || k.includes(key)) {
      return price;
    }
  }
  return null;
}
