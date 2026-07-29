"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, can } from "@/lib/permissions";
import type { PazSalvoDocumentType } from "@/lib/paz-salvo/types";

export type ActionResult = { success: true } | { success: false; message: string };

const MAX_BYTES = 10 * 1024 * 1024;

export async function uploadPazSalvoDocument(
  clientId: string,
  cityId: string,
  cediName: string,
  period: string,
  documentType: PazSalvoDocumentType,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user || !can(user.permissions, "conciliacion.edit")) {
    return { success: false, message: "No tienes permiso para adjuntar documentos." };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { success: false, message: "Selecciona un archivo." };
  }
  if (file.size > MAX_BYTES) {
    return { success: false, message: "El archivo supera el tamaño máximo permitido (10 MB)." };
  }
  if (file.type !== "application/pdf") {
    return { success: false, message: "Solo se permite adjuntar archivos PDF." };
  }

  const supabase = await createClient();
  const path = `${encodeURIComponent(cediName)}/${period}/${crypto.randomUUID()}-${file.name}`;

  const { error: uploadError } = await supabase.storage
    .from("paz-salvo")
    .upload(path, file, { contentType: file.type });

  if (uploadError) {
    return { success: false, message: uploadError.message };
  }

  // Reemplaza el documento anterior de ese cedi/mes, si existe.
  const { data: existing } = await supabase
    .from("paz_salvo_documents")
    .select("id, storage_path")
    .eq("client_id", clientId)
    .eq("cedi_name", cediName)
    .eq("period", period)
    .is("deleted_at", null)
    .maybeSingle();

  if (existing) {
    await supabase.from("paz_salvo_documents").update({ deleted_at: new Date().toISOString() }).eq("id", existing.id);
    await supabase.storage.from("paz-salvo").remove([existing.storage_path]);
  }

  const { error } = await supabase.from("paz_salvo_documents").insert({
    client_id: clientId,
    city_id: cityId,
    cedi_name: cediName,
    period,
    document_type: documentType,
    storage_path: path,
    file_name: file.name,
    uploaded_by: user.userId,
  });

  if (error) {
    await supabase.storage.from("paz-salvo").remove([path]);
    return { success: false, message: error.message };
  }

  revalidatePath(`/clientes/${clientId}/paz-y-salvos`);
  return { success: true };
}

export async function getPazSalvoDocumentUrl(storagePath: string): Promise<string | null> {
  const user = await getCurrentUser();
  if (!user || !can(user.permissions, "conciliacion.view")) return null;

  const supabase = await createClient();
  const { data } = await supabase.storage.from("paz-salvo").createSignedUrl(storagePath, 60);
  return data?.signedUrl ?? null;
}
