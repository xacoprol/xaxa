import OpenAI from "openai";
import { createClient as createSupabaseJs } from "@supabase/supabase-js";
import { findStockMealImage } from "@/lib/menus/stock-images";

export const MEAL_IMAGES_BUCKET = "meal-images";

function adminStorage() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Faltan credenciales de Supabase Storage");
  }
  return createSupabaseJs(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function generateMealImageBuffer(
  dishName: string,
  tags: string[] = []
): Promise<Buffer> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Falta OPENAI_API_KEY");
  }

  const openai = new OpenAI({ apiKey });
  const tagLine = tags.length ? ` Style: ${tags.slice(0, 4).join(", ")}.` : "";
  const prompt = `Professional food photography of "${dishName}", homemade Spanish/Mediterranean home cooking, plated appetizingly on a ceramic plate, natural daylight, shallow depth of field, no text, no watermark, no people.${tagLine}`;

  const result = await openai.images.generate({
    model: "gpt-image-1-mini",
    prompt,
    size: "1024x1024",
  });

  const b64 = result.data?.[0]?.b64_json;
  if (b64) {
    return Buffer.from(b64, "base64");
  }

  const imageUrl = result.data?.[0]?.url;
  if (imageUrl) {
    const res = await fetch(imageUrl);
    if (!res.ok) {
      throw new Error(`No se pudo descargar la imagen (${res.status})`);
    }
    return Buffer.from(await res.arrayBuffer());
  }

  throw new Error("OpenAI no devolvió imagen");
}

export async function uploadMealImage(
  householdId: string,
  mealId: string,
  buffer: Buffer,
  contentType: string = "image/jpeg"
): Promise<string> {
  const supabase = adminStorage();
  const ext = contentType.includes("png") ? "png" : "jpg";
  const path = `${householdId}/${mealId}.${ext}`;
  const { error } = await supabase.storage
    .from(MEAL_IMAGES_BUCKET)
    .upload(path, buffer, {
      contentType,
      upsert: true,
    });

  if (error) {
    throw new Error(`Error al subir foto: ${error.message}`);
  }

  const { data } = supabase.storage.from(MEAL_IMAGES_BUCKET).getPublicUrl(path);
  if (!data.publicUrl) {
    throw new Error("No se pudo obtener la URL pública de la foto");
  }
  // Cache-bust al regenerar
  return `${data.publicUrl}?v=${Date.now()}`;
}

/**
 * Foto del plato: primero stock real online; si no hay, OpenAI.
 * `preferAi` fuerza generación IA (p. ej. botón regenerar).
 */
export async function attachMealImage(opts: {
  householdId: string;
  mealId: string;
  name: string;
  tags?: string[];
  preferAi?: boolean;
}): Promise<{ imageUrl: string; source: "stock" | "openai" }> {
  const tags = opts.tags ?? [];

  if (!opts.preferAi) {
    const stock = await findStockMealImage(opts.name, tags);
    if (stock) {
      console.info(
        `[meal-image] stock/${stock.source}: ${opts.name}`
      );
      const imageUrl = await uploadMealImage(
        opts.householdId,
        opts.mealId,
        stock.buffer,
        "image/jpeg"
      );
      return { imageUrl, source: "stock" };
    }
  }

  console.info(`[meal-image] openai: ${opts.name}`);
  const buffer = await generateMealImageBuffer(opts.name, tags);
  const imageUrl = await uploadMealImage(
    opts.householdId,
    opts.mealId,
    buffer,
    "image/png"
  );
  return { imageUrl, source: "openai" };
}
