"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, can } from "@/lib/permissions";
import {
  reconciliationFormSchema,
  normalizeReconciliationInput,
} from "@/lib/validations/reconciliation";
import { parseBulkReconciliationsText } from "@/lib/reconciliations/bulk-parse";
import { getLoadTypes, getVisibleCities } from "@/lib/catalog/queries";
import { getMatchingReconciliationIds } from "@/lib/reconciliations/queries";
import type { ReconciliationsFilters } from "@/lib/reconciliations/types";

export type ActionResult =
  | { success: true; matched?: boolean }
  | { success: false; message: string };
export type BulkActionResult = { success: true; affected: number } | { success: false; message: string };

export type BulkImportResult =
  | {
      success: true;
      summary: { total: number; created: number; matched: number; duplicated: number; rejected: number };
      errorRows: { rowNumber: number; raw: string; reasons: string[] }[];
    }
  | { success: false; message: string };

const INSERT_CHUNK_SIZE = 200;
const DUPLICATE_SERVICE_NUMBER_MESSAGE =
  "Ya existe una conciliación con ese número de servicio para este cliente. Una guía no puede conciliarse dos veces.";

export async function createReconciliation(input: unknown): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user || !can(user.permissions, "conciliacion.create")) {
    return { success: false, message: "No tienes permiso para crear conciliaciones." };
  }

  const parsed = reconciliationFormSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reconciliations")
    .insert(normalizeReconciliationInput(parsed.data))
    .select("id")
    .single();

  if (error || !data) {
    const message = error?.code === "23505" ? DUPLICATE_SERVICE_NUMBER_MESSAGE : error?.message ?? "No se pudo guardar.";
    return { success: false, message };
  }

  const { data: status } = await supabase.rpc("reconcile_collection", { p_reconciliation_id: data.id });

  revalidatePath("/conciliacion");
  revalidatePath("/recoleccion");
  return { success: true, matched: status === "matched" };
}

export async function updateReconciliation(id: string, input: unknown): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user || !can(user.permissions, "conciliacion.edit")) {
    return { success: false, message: "No tienes permiso para editar conciliaciones." };
  }

  const parsed = reconciliationFormSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const supabase = await createClient();

  // Se limpia el cruce anterior antes de guardar, para no dejar una
  // recoleccion marcada "Conciliado" contra datos que ya cambiaron.
  await supabase.rpc("unreconcile_collection", { p_reconciliation_id: id });

  const { error } = await supabase
    .from("reconciliations")
    .update(normalizeReconciliationInput(parsed.data))
    .eq("id", id);

  if (error) {
    const message = error.code === "23505" ? DUPLICATE_SERVICE_NUMBER_MESSAGE : error.message;
    return { success: false, message };
  }

  const { data: status } = await supabase.rpc("reconcile_collection", { p_reconciliation_id: id });

  revalidatePath("/conciliacion");
  revalidatePath("/recoleccion");
  return { success: true, matched: status === "matched" };
}

export async function deleteReconciliation(id: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user || !can(user.permissions, "conciliacion.delete")) {
    return { success: false, message: "No tienes permiso para eliminar conciliaciones." };
  }

  const supabase = await createClient();

  await supabase.rpc("unreconcile_collection", { p_reconciliation_id: id });

  const { error } = await supabase
    .from("reconciliations")
    .update({ deleted_at: new Date().toISOString(), deleted_by: user.userId })
    .eq("id", id);

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath("/conciliacion");
  revalidatePath("/recoleccion");
  return { success: true };
}

export async function bulkDeleteReconciliations(ids: string[]): Promise<BulkActionResult> {
  const user = await getCurrentUser();
  if (!user || !can(user.permissions, "conciliacion.delete")) {
    return { success: false, message: "No tienes permiso para eliminar conciliaciones." };
  }
  if (ids.length === 0) {
    return { success: false, message: "No hay registros seleccionados." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("reconciliations_bulk_delete", { p_ids: ids });

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath("/conciliacion");
  revalidatePath("/recoleccion");
  return { success: true, affected: Number(data ?? 0) };
}

export async function getMatchingIds(filters: ReconciliationsFilters): Promise<string[]> {
  const user = await getCurrentUser();
  if (!user || !can(user.permissions, "conciliacion.view")) return [];
  return getMatchingReconciliationIds(filters);
}

export async function bulkCreateReconciliations(
  clientId: string,
  cityId: string,
  rawText: string,
): Promise<BulkImportResult> {
  const user = await getCurrentUser();
  if (!user || !can(user.permissions, "conciliacion.import")) {
    return { success: false, message: "No tienes permiso para importar conciliaciones." };
  }

  if (!clientId) {
    return { success: false, message: "Selecciona el cliente para este lote." };
  }
  if (!cityId) {
    return { success: false, message: "Selecciona la ciudad para este lote." };
  }

  const [loadTypes, cities] = await Promise.all([getLoadTypes(), getVisibleCities()]);
  const cityName = cities.find((c) => c.id === cityId)?.name ?? "";
  const parsedRows = parseBulkReconciliationsText(rawText, loadTypes, cityId, cityName);

  if (parsedRows.length === 0) {
    return { success: false, message: "No se encontró ningún dato para importar." };
  }

  const supabase = await createClient();

  const validRows = parsedRows.filter((row) => row.errors.length === 0);
  const invalidRows = parsedRows.filter((row) => row.errors.length > 0);

  // Una guia no puede conciliarse dos veces: se revisa antes de insertar,
  // igual que en Recoleccion.
  let dbDuplicateNumbers = new Set<string>();
  if (validRows.length > 0) {
    const { data: existing } = await supabase
      .from("reconciliations")
      .select("service_number")
      .eq("client_id", clientId)
      .is("deleted_at", null)
      .in(
        "service_number",
        validRows.map((r) => r.service_number),
      );
    dbDuplicateNumbers = new Set((existing ?? []).map((r) => r.service_number));
  }

  const toInsert = validRows.filter((row) => !dbDuplicateNumbers.has(row.service_number));
  const dbDuplicateRows = validRows.filter((row) => dbDuplicateNumbers.has(row.service_number));

  const insertedIds: string[] = [];
  const failedDuringInsert: { row: (typeof toInsert)[number]; reasons: string[] }[] = [];

  for (let i = 0; i < toInsert.length; i += INSERT_CHUNK_SIZE) {
    const chunk = toInsert.slice(i, i + INSERT_CHUNK_SIZE);
    const { data, error } = await supabase
      .from("reconciliations")
      .insert(
        chunk.map((row) => ({
          client_id: clientId,
          service_number: row.service_number,
          client_name: row.client_name,
          novedad: row.novedad,
          city_id: row.city_id,
          cedi_code: row.cedi_code,
          cedi_name: row.cedi_name,
          service_address: row.service_address,
          service_date: row.service_date,
          load_type_id: row.load_type_id,
          client_document: row.client_document,
          collection_amount: row.collection_amount,
        })),
      )
      .select("id");

    if (error) {
      const reason = error.code === "23505" ? DUPLICATE_SERVICE_NUMBER_MESSAGE : error.message;
      chunk.forEach((row) => failedDuringInsert.push({ row, reasons: [reason] }));
    } else {
      insertedIds.push(...(data ?? []).map((r) => r.id));
    }
  }

  let matchedCount = 0;
  if (insertedIds.length > 0) {
    const { data: matchResults } = await supabase.rpc("reconcile_collections_batch", {
      p_reconciliation_ids: insertedIds,
    });
    matchedCount = (matchResults ?? []).filter((r: { status: string }) => r.status === "matched").length;
  }

  const allRejected = [
    ...invalidRows.map((row) => ({ row, reasons: row.errors })),
    ...dbDuplicateRows.map((row) => ({
      row,
      reasons: [`Guía ${row.service_number} ya conciliada para este cliente`],
    })),
    ...failedDuringInsert,
  ];

  const { data: batch } = await supabase
    .from("import_batches")
    .insert({
      module: "conciliacion",
      user_id: user.userId,
      total_received: parsedRows.length,
      total_success: insertedIds.length,
      total_rejected: invalidRows.length + failedDuringInsert.length,
      total_duplicated: dbDuplicateRows.length,
      status: "completed",
    })
    .select("id")
    .single();

  if (batch?.id && allRejected.length > 0) {
    await supabase.from("import_errors").insert(
      allRejected.map(({ row, reasons }) => ({
        batch_id: batch.id,
        row_number: row.rowNumber,
        error_reason: reasons.join("; "),
        raw_data: row,
      })),
    );
  }

  revalidatePath("/conciliacion");
  revalidatePath("/recoleccion");

  return {
    success: true,
    summary: {
      total: parsedRows.length,
      created: insertedIds.length,
      matched: matchedCount,
      duplicated: dbDuplicateRows.length,
      rejected: invalidRows.length + failedDuringInsert.length,
    },
    errorRows: allRejected.map(({ row, reasons }) => ({
      rowNumber: row.rowNumber,
      raw: row.raw,
      reasons,
    })),
  };
}
