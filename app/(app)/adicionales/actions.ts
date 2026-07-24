"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, can } from "@/lib/permissions";
import {
  additionalServiceCreateSchema,
  additionalServiceEditSchema,
  buildCreateRows,
  normalizeEditInput,
} from "@/lib/validations/additional-service";
import { getMatchingAdditionalServiceIds } from "@/lib/additional-services/queries";
import type { AdditionalServiceStatus, AdditionalServiceFilters } from "@/lib/additional-services/types";

export type ActionResult = { success: true } | { success: false; message: string };
export type BulkActionResult = { success: true; affected: number } | { success: false; message: string };
export type DuplicateResult = { success: true; id: string } | { success: false; message: string };

const FACTURADO_LOCK_MESSAGE =
  "Este registro está Facturado y no se puede editar. Un Administrador debe revertirlo primero.";

const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;
const ATTACHMENT_ALLOWED_MIME = ["application/pdf", "image/png", "image/jpeg", "image/webp"];
export type AttachmentFileType = "soporte_entregas" | "autorizacion_cliente";

function revalidate() {
  revalidatePath("/adicionales");
}

export async function createAdditionalService(input: unknown): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user || !can(user.permissions, "adicionales.create")) {
    return { success: false, message: "No tienes permiso para crear registros." };
  }

  const parsed = additionalServiceCreateSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const resourceGroupId = parsed.data.resources.length > 1 ? crypto.randomUUID() : null;
  const rows = buildCreateRows(parsed.data, resourceGroupId);

  const supabase = await createClient();
  const { error } = await supabase.from("additional_services").insert(rows);

  if (error) {
    return { success: false, message: error.message };
  }

  revalidate();
  return { success: true };
}

export async function updateAdditionalService(id: string, input: unknown): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user || !can(user.permissions, "adicionales.edit")) {
    return { success: false, message: "No tienes permiso para editar registros." };
  }

  const parsed = additionalServiceEditSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const supabase = await createClient();

  const { data: current } = await supabase
    .from("additional_services")
    .select("status")
    .eq("id", id)
    .single();

  if (current?.status === "facturado") {
    return { success: false, message: FACTURADO_LOCK_MESSAGE };
  }

  const { error } = await supabase
    .from("additional_services")
    .update(normalizeEditInput(parsed.data))
    .eq("id", id);

  if (error) {
    return { success: false, message: error.message };
  }

  revalidate();
  return { success: true };
}

export async function deleteAdditionalService(id: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user || !can(user.permissions, "adicionales.delete")) {
    return { success: false, message: "No tienes permiso para eliminar registros." };
  }

  const supabase = await createClient();

  const { data: current } = await supabase
    .from("additional_services")
    .select("status")
    .eq("id", id)
    .single();

  if (current?.status === "facturado") {
    return { success: false, message: "Un registro Facturado no se puede eliminar." };
  }

  const { error } = await supabase
    .from("additional_services")
    .update({ deleted_at: new Date().toISOString(), deleted_by: user.userId })
    .eq("id", id);

  if (error) {
    return { success: false, message: error.message };
  }

  revalidate();
  return { success: true };
}

/** Crea una copia en estado "Pendiente"; el original queda intacto. */
export async function duplicateAdditionalService(id: string): Promise<DuplicateResult> {
  const user = await getCurrentUser();
  if (!user || !can(user.permissions, "adicionales.create")) {
    return { success: false, message: "No tienes permiso para duplicar registros." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("additional_services_duplicate", { p_id: id });

  if (error || !data) {
    return { success: false, message: error?.message ?? "No se pudo duplicar el registro." };
  }

  revalidate();
  return { success: true, id: data as string };
}

/** Cambia el estado de uno o varios registros. Salir de "facturado" exige
 * motivo y el permiso adicionales.revert (Administrador), validado en la BD. */
export async function setAdditionalServiceStatus(
  ids: string[],
  status: AdditionalServiceStatus,
  revertedReason?: string,
): Promise<BulkActionResult> {
  const user = await getCurrentUser();
  if (!user || !can(user.permissions, "adicionales.edit")) {
    return { success: false, message: "No tienes permiso para cambiar el estado." };
  }
  if (ids.length === 0) {
    return { success: false, message: "No hay registros seleccionados." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("additional_services_bulk_set_status", {
    p_ids: ids,
    p_status: status,
    p_reverted_reason: revertedReason ?? null,
  });

  if (error) {
    return { success: false, message: error.message };
  }

  revalidate();
  return { success: true, affected: Number(data ?? 0) };
}

export async function bulkDeleteAdditionalServices(ids: string[]): Promise<BulkActionResult> {
  const user = await getCurrentUser();
  if (!user || !can(user.permissions, "adicionales.delete")) {
    return { success: false, message: "No tienes permiso para eliminar registros." };
  }
  if (ids.length === 0) {
    return { success: false, message: "No hay registros seleccionados." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("additional_services_bulk_delete", { p_ids: ids });

  if (error) {
    return { success: false, message: error.message };
  }

  revalidate();
  return { success: true, affected: Number(data ?? 0) };
}

export async function getMatchingIds(filters: AdditionalServiceFilters): Promise<string[]> {
  const user = await getCurrentUser();
  if (!user || !can(user.permissions, "adicionales.view")) return [];
  return getMatchingAdditionalServiceIds(filters);
}

export type AttachmentRow = {
  id: string;
  file_type: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  uploaded_at: string;
  storage_path: string;
};

export async function getAttachments(recordId: string): Promise<AttachmentRow[]> {
  const user = await getCurrentUser();
  if (!user || !can(user.permissions, "adicionales.view")) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("file_attachments")
    .select("id, file_type, file_name, mime_type, size_bytes, uploaded_at, storage_path")
    .eq("module", "adicionales")
    .eq("record_id", recordId)
    .order("uploaded_at", { ascending: false });

  return (data ?? []) as AttachmentRow[];
}

export async function uploadAttachment(
  recordId: string,
  fileType: AttachmentFileType,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user || !can(user.permissions, "adicionales.edit")) {
    return { success: false, message: "No tienes permiso para adjuntar archivos." };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { success: false, message: "Selecciona un archivo." };
  }
  if (file.size > ATTACHMENT_MAX_BYTES) {
    return { success: false, message: "El archivo supera el tamaño máximo permitido (10 MB)." };
  }
  if (!ATTACHMENT_ALLOWED_MIME.includes(file.type)) {
    return { success: false, message: "Formato no permitido. Usa PDF, PNG, JPG o WEBP." };
  }

  const supabase = await createClient();
  const path = `${recordId}/${crypto.randomUUID()}-${file.name}`;

  const { error: uploadError } = await supabase.storage
    .from("adicionales")
    .upload(path, file, { contentType: file.type });

  if (uploadError) {
    return { success: false, message: uploadError.message };
  }

  const { error } = await supabase.from("file_attachments").insert({
    module: "adicionales",
    record_id: recordId,
    file_type: fileType,
    storage_path: path,
    file_name: file.name,
    mime_type: file.type,
    size_bytes: file.size,
    uploaded_by: user.userId,
  });

  if (error) {
    await supabase.storage.from("adicionales").remove([path]);
    return { success: false, message: error.message };
  }

  revalidate();
  return { success: true };
}

export async function deleteAttachment(attachmentId: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user || !can(user.permissions, "adicionales.edit")) {
    return { success: false, message: "No tienes permiso para eliminar adjuntos." };
  }

  const supabase = await createClient();
  const { data: attachment } = await supabase
    .from("file_attachments")
    .select("storage_path")
    .eq("id", attachmentId)
    .single();

  if (!attachment) {
    return { success: false, message: "Adjunto no encontrado." };
  }

  await supabase.storage.from("adicionales").remove([attachment.storage_path]);

  const { error } = await supabase.from("file_attachments").delete().eq("id", attachmentId);
  if (error) {
    return { success: false, message: error.message };
  }

  revalidate();
  return { success: true };
}

export async function getAttachmentUrl(storagePath: string): Promise<string | null> {
  const user = await getCurrentUser();
  if (!user || !can(user.permissions, "adicionales.view")) return null;

  const supabase = await createClient();
  const { data } = await supabase.storage.from("adicionales").createSignedUrl(storagePath, 60);
  return data?.signedUrl ?? null;
}
