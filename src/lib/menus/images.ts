import OpenAI from "openai";
import { createClient as createSupabaseJs } from "@supabase/supabase-js";

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
): Promise<Buffer | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const openai = new OpenAI({ apiKey });
  const tagLine = tags.length ? ` Estilo: ${tags.slice(0, 4).join(", ")}.` : "";
  const prompt = `Professional food photography of "${dishName}", homemade Spanish/Mediterranean home cooking, plated appetizingly on a ceramic plate, natural daylight, shallow depth of field, no text, no watermark, no people.${tagLine}`;

  try {
    const result = await openai.images.generate({
      model: "dall-e-3",
      prompt,
      size: "1024x1024",
      quality: "standard",
      n: 1,
      response_format: "b64_json",
    });
    const b64 = result.data?.[0]?.b64_json;
    if (!b64) return null;
    return Buffer.from(b64, "base64");
  } catch (error) {
    console.error("[meal-images] generate failed:", error);
    return null;
  }
}

export async function uploadMealImage(
  householdId: string,
  mealId: string,
  buffer: Buffer
): Promise<string | null> {
  try {
    const supabase = adminStorage();
    const path = `${householdId}/${mealId}.png`;
    const { error } = await supabase.storage
      .from(MEAL_IMAGES_BUCKET)
      .upload(path, buffer, {
        contentType: "image/png",
        upsert: true,
      });

    if (error) {
      console.error("[meal-images] upload failed:", error.message);
      return null;
    }

    const { data } = supabase.storage
      .from(MEAL_IMAGES_BUCKET)
      .getPublicUrl(path);
    return data.publicUrl || null;
  } catch (error) {
    console.error("[meal-images] upload unexpected:", error);
    return null;
  }
}

/** Generate + upload; returns public URL or null (never throws). */
export async function attachMealImage(opts: {
  householdId: string;
  mealId: string;
  name: string;
  tags?: string[];
}): Promise<string | null> {
  const buffer = await generateMealImageBuffer(opts.name, opts.tags ?? []);
  if (!buffer) return null;
  return uploadMealImage(opts.householdId, opts.mealId, buffer);
}
