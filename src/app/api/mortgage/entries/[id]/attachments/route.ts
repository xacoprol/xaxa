import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiHousehold } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

type Params = { params: { id: string } };

const BUCKET = "mortgage-attachments";

export async function POST(request: Request, { params }: Params) {
  const { ctx, error } = await requireApiHousehold();
  if (error || !ctx) return error!;

  const entry = await prisma.mortgageEntry.findFirst({
    where: { id: params.id, householdId: ctx.household.id },
  });
  if (!entry) {
    return NextResponse.json({ error: "Entrada no encontrada" }, { status: 404 });
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Falta el archivo" }, { status: 400 });
  }

  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json(
      { error: "Máximo 10 MB por archivo" },
      { status: 400 }
    );
  }

  const supabase = createClient();
  const ext = file.name.split(".").pop() ?? "bin";
  const path = `${ctx.household.id}/${entry.id}/${Date.now()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json(
      {
        error: `Error al subir: ${uploadError.message}. ¿Existe el bucket "${BUCKET}" en Supabase Storage?`,
      },
      { status: 502 }
    );
  }

  const { data: publicUrl } = supabase.storage.from(BUCKET).getPublicUrl(path);

  const attachment = await prisma.mortgageAttachment.create({
    data: {
      entryId: entry.id,
      fileName: file.name,
      fileUrl: publicUrl.publicUrl || path,
      mimeType: file.type || null,
      sizeBytes: file.size,
    },
  });

  return NextResponse.json({ attachment }, { status: 201 });
}
