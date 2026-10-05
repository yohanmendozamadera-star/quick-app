"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentUser, can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  clientId: z.uuid(), cityId: z.uuid(), date: z.iso.date(),
  cediName: z.string().trim().min(1).max(500),
  storagePath: z.string().min(1).max(500),
  fileName: z.string().min(1).max(255),
});

export async function saveRecaudoPhoto(input: unknown): Promise<{ success: boolean; message?: string }> {
  const user = await getCurrentUser();
  if (!user || !can(user.permissions,"conciliacion.view") || !can(user.permissions,"conciliacion.edit"))
    return { success: false, message: "No tienes permiso para adjuntar consignaciones." };
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { success: false, message: "Datos de consignación inválidos." };
  const { clientId, cityId, date, cediName, storagePath, fileName } = parsed.data;
  const prefix = `${clientId}/${cityId}/${date}/`;
  if (!storagePath.startsWith(prefix) || !/^[0-9a-f-]{36}\.(jpg|png|webp)$/.test(storagePath.slice(prefix.length)))
    return { success: false, message: "La foto no corresponde a este recaudo." };
  const supabase = await createClient();
  const { data: group, error: groupError } = await supabase.rpc("recaudos_resumen", {
    p_client_id: clientId, p_date_from: date, p_date_to: date, p_city_id: cityId,
  });
  const exists = Array.isArray(group) && group.some((r: { cediName: string }) => r.cediName === cediName);
  if (groupError || !exists) return { success: false, message: "No se encontró el recaudo o no tienes acceso a esa ciudad." };
  const { data: info, error: infoError } = await supabase.storage.from("recaudos").info(storagePath);
  if (infoError || !info || !["image/jpeg","image/png","image/webp"].includes(info.contentType ?? "") ||
      (info.size ?? 0) <= 0 || (info.size ?? Infinity) > 10 * 1024 * 1024)
    return { success: false, message: "Solo se admiten fotos JPG, PNG o WebP de hasta 10 MB." };
  const { data: existing, error: existingError } = await supabase.from("recaudo_documents")
    .select("storage_path").eq("client_id",clientId).eq("city_id",cityId)
    .eq("reconciliation_date",date).eq("cedi_name",cediName).maybeSingle();
  if (existingError) return { success: false, message: "No se pudo consultar la consignación anterior." };
  const { error } = await supabase.from("recaudo_documents").upsert({
    client_id: clientId, city_id: cityId, reconciliation_date: date, cedi_name: cediName,
    storage_path: storagePath, file_name: fileName, uploaded_by: user.userId,
    uploaded_at: new Date().toISOString(),
  }, { onConflict: "client_id,city_id,reconciliation_date,cedi_name" });
  if (error) return { success: false, message: "No se pudo guardar la consignación. Intenta nuevamente." };
  if (existing && existing.storage_path !== storagePath)
    await supabase.storage.from("recaudos").remove([existing.storage_path]);
  revalidatePath(`/clientes/${clientId}/recaudos`);
  return { success: true };
}

export async function getRecaudoPhotoUrl(documentId: string): Promise<string | null> {
  const user = await getCurrentUser();
  if (!user || !can(user.permissions,"conciliacion.view") || !z.uuid().safeParse(documentId).success) return null;
  const supabase = await createClient();
  const { data: doc } = await supabase.from("recaudo_documents").select("storage_path").eq("id",documentId).maybeSingle();
  if (!doc) return null;
  const { data } = await supabase.storage.from("recaudos").createSignedUrl(doc.storage_path,300);
  return data?.signedUrl ?? null;
}

