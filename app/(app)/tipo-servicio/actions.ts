"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, can } from "@/lib/permissions";
import {
  serviceTypeRecordFormSchema,
  normalizeServiceTypeRecordInput,
} from "@/lib/validations/service-type-record";
import { getMatchingServiceTypeIds } from "@/lib/service-types/queries";
import type { BillingStatus, ServiceTypeFilters } from "@/lib/service-types/types";

export type ActionResult = { success: true; matched?: boolean } | { success: false; message: string };
export type BulkActionResult = { success: true; affected: number } | { success: false; message: string };

const VERIFICADO_LOCK_MESSAGE =
  "Este registro está Verificado y no se puede editar. Un Administrador debe revertirlo primero.";

function revalidateBoth() {
  revalidatePath("/tipo-servicio");
  revalidatePath("/conciliacion");
  revalidatePath("/recoleccion");
}

export async function createServiceTypeRecord(input: unknown): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user || !can(user.permissions, "tipo_servicio.create")) {
    return { success: false, message: "No tienes permiso para crear registros." };
  }

  const parsed = serviceTypeRecordFormSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reconciliations")
    .insert(normalizeServiceTypeRecordInput(parsed.data))
    .select("id")
    .single();

  if (error || !data) {
    const message = error?.code === "23505" ? "Ya existe un registro con ese número de servicio para este cliente." : error?.message ?? "No se pudo guardar.";
    return { success: false, message };
  }

  const { data: status } = await supabase.rpc("reconcile_collection", { p_reconciliation_id: data.id });

  revalidateBoth();
  return { success: true, matched: status === "matched" };
}

export async function updateServiceTypeRecord(id: string, input: unknown): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user || !can(user.permissions, "tipo_servicio.edit")) {
    return { success: false, message: "No tienes permiso para editar registros." };
  }

  const parsed = serviceTypeRecordFormSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const supabase = await createClient();

  const { data: current } = await supabase
    .from("reconciliations")
    .select("billing_status")
    .eq("id", id)
    .single();

  if (current?.billing_status === "verificado") {
    return { success: false, message: VERIFICADO_LOCK_MESSAGE };
  }

  await supabase.rpc("unreconcile_collection", { p_reconciliation_id: id });

  const { error } = await supabase
    .from("reconciliations")
    .update(normalizeServiceTypeRecordInput(parsed.data))
    .eq("id", id);

  if (error) {
    const message = error.code === "23505" ? "Ya existe un registro con ese número de servicio para este cliente." : error.message;
    return { success: false, message };
  }

  const { data: status } = await supabase.rpc("reconcile_collection", { p_reconciliation_id: id });

  revalidateBoth();
  return { success: true, matched: status === "matched" };
}

export async function deleteServiceTypeRecord(id: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user || !can(user.permissions, "tipo_servicio.delete")) {
    return { success: false, message: "No tienes permiso para eliminar registros." };
  }

  const supabase = await createClient();

  const { data: current } = await supabase
    .from("reconciliations")
    .select("billing_status")
    .eq("id", id)
    .single();

  if (current?.billing_status === "verificado") {
    return { success: false, message: "Un registro Verificado no se puede eliminar." };
  }

  await supabase.rpc("unreconcile_collection", { p_reconciliation_id: id });

  const { error } = await supabase
    .from("reconciliations")
    .update({ deleted_at: new Date().toISOString(), deleted_by: user.userId })
    .eq("id", id);

  if (error) {
    return { success: false, message: error.message };
  }

  revalidateBoth();
  return { success: true };
}

/**
 * Cambia el estado de verificación de uno o varios registros (mismo flujo
 * para el clic individual y el cambio masivo). Revertir a "No verificado"
 * exige motivo y permiso de Administrador, que valida la función en la
 * base de datos.
 */
export async function setBillingStatus(
  ids: string[],
  status: BillingStatus,
  revertedReason?: string,
): Promise<BulkActionResult> {
  const user = await getCurrentUser();
  if (!user || !can(user.permissions, "tipo_servicio.edit")) {
    return { success: false, message: "No tienes permiso para cambiar el estado." };
  }
  if (status === "no_verificado" && !can(user.permissions, "tipo_servicio.revert")) {
    return { success: false, message: "Solo un Administrador puede revertir a No verificado." };
  }
  if (ids.length === 0) {
    return { success: false, message: "No hay registros seleccionados." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("service_type_bulk_set_billing_status", {
    p_ids: ids,
    p_status: status,
    p_reverted_reason: revertedReason ?? null,
  });

  if (error) {
    return { success: false, message: error.message };
  }

  revalidateBoth();
  return { success: true, affected: Number(data ?? 0) };
}

export async function bulkSetLoadType(ids: string[], loadTypeId: string): Promise<BulkActionResult> {
  const user = await getCurrentUser();
  if (!user || !can(user.permissions, "tipo_servicio.edit")) {
    return { success: false, message: "No tienes permiso para editar registros." };
  }
  if (ids.length === 0) {
    return { success: false, message: "No hay registros seleccionados." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("service_type_bulk_set_load_type", {
    p_ids: ids,
    p_load_type_id: loadTypeId,
  });

  if (error) {
    return { success: false, message: error.message };
  }

  revalidateBoth();
  return { success: true, affected: Number(data ?? 0) };
}

export async function bulkDeleteServiceTypeRecords(ids: string[]): Promise<BulkActionResult> {
  const user = await getCurrentUser();
  if (!user || !can(user.permissions, "tipo_servicio.delete")) {
    return { success: false, message: "No tienes permiso para eliminar registros." };
  }
  if (ids.length === 0) {
    return { success: false, message: "No hay registros seleccionados." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("service_type_bulk_delete", { p_ids: ids });

  if (error) {
    return { success: false, message: error.message };
  }

  revalidateBoth();
  return { success: true, affected: Number(data ?? 0) };
}

export async function getMatchingIds(filters: ServiceTypeFilters): Promise<string[]> {
  const user = await getCurrentUser();
  if (!user || !can(user.permissions, "tipo_servicio.view")) return [];
  return getMatchingServiceTypeIds(filters);
}
