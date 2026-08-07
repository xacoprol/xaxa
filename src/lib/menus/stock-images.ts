/**
 * Busca foto real de un plato online (sin OpenAI).
 * Orden: TheMealDB → Openverse (CC) → Pexels (si hay key) → null.
 */

type StockHit = {
  url: string;
  source: "themealdb" | "openverse" | "pexels";
};

const FOOD_HINT =
  /\b(food|comida|plato|dish|meal|recipe|cocina|cook|plate|serving|gourmet|pasta|arroz|pollo|carne|sopa|ensalada|pescado|verdura|guiso|asado|horneado|paella|tortilla)\b/i;

function buildQueries(dishName: string, tags: string[]): string[] {
  const clean = dishName
    .replace(/["""']/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const tag = tags[0] ? ` ${tags[0]}` : "";
  // Primera palabra útil para TheMealDB (suele ir en inglés/simple)
  const firstWords = clean.split(/\s+/).slice(0, 3).join(" ");
  return [
    clean,
    `${clean} plato`,
    `${clean} food`,
    firstWords,
    `${clean}${tag}`,
  ].filter((q, i, arr) => q.length >= 3 && arr.indexOf(q) === i);
}

async function fetchImageBuffer(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "XAXA-Menus/1.0 (household meal photos)",
        Accept: "image/*,*/*",
      },
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "";
    if (type && !type.startsWith("image/")) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 8_000 || buf.length > 8_000_000) return null;
    return buf;
  } catch {
    return null;
  }
}

/** TheMealDB — catálogo de recetas con foto (gratis, sin key). */
async function searchMealDb(query: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(query)}`,
      { signal: AbortSignal.timeout(8_000) }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      meals?: Array<{ strMealThumb?: string | null }> | null;
    };
    const thumb = data.meals?.[0]?.strMealThumb;
    if (thumb?.startsWith("http")) return thumb;
  } catch {
    // ignore
  }
  return null;
}

async function searchOpenverse(query: string): Promise<string | null> {
  const params = new URLSearchParams({
    q: `${query} food dish`,
    page_size: "12",
    license: "cc0,pdm,by,by-sa",
    category: "photograph",
  });
  try {
    const res = await fetch(
      `https://api.openverse.org/v1/images/?${params}`,
      {
        headers: {
          "User-Agent": "XAXA-Menus/1.0 (https://xx.xacoprol.com)",
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(10_000),
      }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      results?: Array<{
        url?: string;
        thumbnail?: string;
        title?: string;
        tags?: Array<{ name?: string } | string>;
      }>;
    };

    const scored = (data.results ?? [])
      .map((hit) => {
        const title = hit.title ?? "";
        const tags = (hit.tags ?? [])
          .map((t) => (typeof t === "string" ? t : t.name ?? ""))
          .join(" ");
        const blob = `${title} ${tags}`;
        const score = FOOD_HINT.test(blob) ? 2 : 0;
        return { hit, score };
      })
      .sort((a, b) => b.score - a.score);

    for (const { hit, score } of scored) {
      if (score === 0 && scored.some((s) => s.score > 0)) continue;
      const url = hit.url || hit.thumbnail;
      if (url?.startsWith("http")) return url;
    }
  } catch {
    // ignore
  }
  return null;
}

async function searchPexels(query: string): Promise<string | null> {
  const key = process.env.PEXELS_API_KEY;
  if (!key) return null;
  try {
    const params = new URLSearchParams({
      query: `${query} food plated`,
      per_page: "6",
      orientation: "square",
    });
    const res = await fetch(`https://api.pexels.com/v1/search?${params}`, {
      headers: { Authorization: key },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      photos?: Array<{
        src?: { large?: string; medium?: string; original?: string };
      }>;
    };
    for (const photo of data.photos ?? []) {
      const url =
        photo.src?.large || photo.src?.medium || photo.src?.original;
      if (url) return url;
    }
  } catch {
    // ignore
  }
  return null;
}

/** Devuelve buffer de una foto stock o null si no hay nada usable. */
export async function findStockMealImage(
  dishName: string,
  tags: string[] = []
): Promise<{ buffer: Buffer; source: StockHit["source"] } | null> {
  const queries = buildQueries(dishName, tags);

  for (const query of queries.slice(0, 3)) {
    const mealDbUrl = await searchMealDb(query);
    if (mealDbUrl) {
      const buffer = await fetchImageBuffer(mealDbUrl);
      if (buffer) return { buffer, source: "themealdb" };
    }
  }

  for (const query of queries.slice(0, 3)) {
    const openverseUrl = await searchOpenverse(query);
    if (openverseUrl) {
      const buffer = await fetchImageBuffer(openverseUrl);
      if (buffer) return { buffer, source: "openverse" };
    }
  }

  for (const query of queries.slice(0, 2)) {
    const pexelsUrl = await searchPexels(query);
    if (pexelsUrl) {
      const buffer = await fetchImageBuffer(pexelsUrl);
      if (buffer) return { buffer, source: "pexels" };
    }
  }

  return null;
}
