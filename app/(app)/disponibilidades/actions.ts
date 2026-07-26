"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, can } from "@/lib/permissions";
import { availabilityFormSchema, normalizeAvailabilityInput } from "@/lib/validations/availability";
import { getMatchingAvailabilityIds } from "@/lib/availabilities/queries";
import type { AvailabilityStatus, AvailabilityFilters } from "@/lib/availabilities/types";

export type ActionResult = { success: true } | { success: false; message: string };
export type BulkActionResult = { success: true; affected: number } | { success: false; message: string };
export type DuplicateResult = { success: true; id: string } | { success: false; message: string };

const AUTORIZADO_LOCK_MESSAGE = "Este registro está Autorizado y no se puede editar.";

function revalidate() {
  revalidatePath("/disponibilidades");
}

export async function createAvailability(input: unknown): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user || !can(user.permissions, "disponibilidades.create")) {
    return { success: false, message: "No tienes permiso para crear registros." };
  }

  const parsed = availabilityFormSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const supabase = await createClient();

  const { data: orderNumber, error: orderError } = await supabase.rpc("generate_availability_order_number", {
    p_date: parsed.data.date,
  });
  if (orderError || !orderNumber) {
    return { success: false, message: orderError?.message ?? "No se pudo generar el número de orden." };
  }

  const { error } = await supabase.from("availabilities").insert({
    ...normalizeAvailabilityInput(parsed.data),
    order_number: orderNumber,
  });

  if (error) {
    return { success: false, message: error.message };
  }

  revalidate();
  return { success: true };
}

export async function updateAvailability(id: string, input: unknown): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user || !can(user.permissions, "disponibilidades.edit")) {
    return { success: false, message: "No tienes permiso para editar registros." };
  }

  const parsed = availabilityFormSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const supabase = await createClient();

  const { data: current } = await supabase.from("availabilities").select("status").eq("id", id).single();
  if (current?.status === "autorizado") {
    return { success: false, message: AUTORIZADO_LOCK_MESSAGE };
  }

  const { error } = await supabase
    .from("availabilities")
    .update(normalizeAvailabilityInput(parsed.data))
    .eq("id", id);

  if (error) {
    return { success: false, message: error.message };
  }

  revalidate();
  return { success: true };
}

export async function deleteAvailability(id: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user || !can(user.permissions, "disponibilidades.delete")) {
    return { success: false, message: "No tienes permiso para eliminar registros." };
  }

  const supabase = await createClient();

  const { data: current } = await supabase.from("availabilities").select("status").eq("id", id).single();
  if (current?.status === "autorizado") {
    return { success: false, message: "Un registro Autorizado no se puede eliminar." };
  }

  const { error } = await supabase
    .from("availabilities")
    .update({ deleted_at: new Date().toISOString(), deleted_by: user.userId })
    .eq("id", id);

  if (error) {
    return { success: false, message: error.message };
  }

  revalidate();
  return { success: true };
}

/** Crea una copia en estado "Registrado", con fecha de hoy y numero de orden nuevo. */
export async function duplicateAvailability(id: string): Promise<DuplicateResult> {
  const user = await getCurrentUser();
  if (!user || !can(user.permissions, "disponibilidades.create")) {
    return { success: false, message: "No tienes permiso para duplicar registros." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("availabilities_duplicate", { p_id: id });

  if (error || !data) {
    return { success: false, message: error?.message ?? "No se pudo duplicar el registro." };
  }

  revalidate();
  return { success: true, id: data as string };
}

export async function setAvailabilityStatus(ids: string[], status: AvailabilityStatus): Promise<BulkActionResult> {
  const user = await getCurrentUser();
  const canApprove = can(user?.permissions ?? [], "disponibilidades.approve");
  const canAuthorize = can(user?.permissions ?? [], "disponibilidades.authorize");
  if (!user || (!canApprove && !canAuthorize)) {
    return { success: false, message: "No tienes permiso para cambiar el estado." };
  }
  if (ids.length === 0) {
    return { success: false, message: "No hay registros seleccionados." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("availabilities_bulk_set_status", {
    p_ids: ids,
    p_status: status,
  });

  if (error) {
    return { success: false, message: error.message };
  }

  revalidate();
  return { success: true, affected: Number(data ?? 0) };
}

export async function bulkDeleteAvailabilities(ids: string[]): Promise<BulkActionResult> {
  const user = await getCurrentUser();
  if (!user || !can(user.permissions, "disponibilidades.delete")) {
    return { success: false, message: "No tienes permiso para eliminar registros." };
  }
  if (ids.length === 0) {
    return { success: false, message: "No hay registros seleccionados." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("availabilities_bulk_delete", { p_ids: ids });

  if (error) {
    return { success: false, message: error.message };
  }

  revalidate();
  return { success: true, affected: Number(data ?? 0) };
}

export async function getMatchingIds(filters: AvailabilityFilters): Promise<string[]> {
  const user = await getCurrentUser();
  if (!user || !can(user.permissions, "disponibilidades.view")) return [];
  return getMatchingAvailabilityIds(filters);
}
