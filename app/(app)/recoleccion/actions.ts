"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, can } from "@/lib/permissions";
import { collectionFormSchema, normalizeCollectionInput } from "@/lib/validations/collection";
import { parseBulkCollectionsText } from "@/lib/collections/bulk-parse";
import { getLoadTypes, getVisibleCities } from "@/lib/catalog/queries";
import { getMatchingCollectionIds } from "@/lib/collections/queries";
import type { CollectionsFilters } from "@/lib/collections/types";

export type ActionResult = { success: true } | { success: false; message: string };
export type BulkActionResult = { success: true; affected: number } | { success: false; message: string };

export type BulkImportResult =
  | {
      success: true;
      summary: { total: number; created: number; duplicated: number; rejected: number };
      errorRows: { rowNumber: number; raw: string; reasons: string[] }[];
    }
  | { success: false; message: string };

const INSERT_CHUNK_SIZE = 200;

export async function bulkCreateCollections(
  clientId: string,
  cityId: string,
  rawText: string,
): Promise<BulkImportResult> {
  const user = await getCurrentUser();
  if (!user || !can(user.permissions, "recoleccion.import")) {
    return { success: false, message: "No tienes permiso para importar recolecciones." };
  }

  if (!clientId) {
    return { success: false, message: "Selecciona el cliente para este lote." };
  }
  if (!cityId) {
    return { success: false, message: "Selecciona la ciudad para este lote." };
  }

  const [loadTypes, cities] = await Promise.all([getLoadTypes(), getVisibleCities()]);
  const cityName = cities.find((c) => c.id === cityId)?.name ?? "";
  const parsedRows = parseBulkCollectionsText(rawText, loadTypes, cityId, cityName);

  if (parsedRows.length === 0) {
    return { success: false, message: "No se encontró ningún dato para importar." };
  }

  const supabase = await createClient();

  const validRows = parsedRows.filter((row) => row.errors.length === 0);
  const invalidRows = parsedRows.filter((row) => row.errors.length > 0);

  let dbDuplicateNumbers = new Set<string>();
  if (validRows.length > 0) {
    const { data: existing } = await supabase
      .from("collections")
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

  // La guia ya existia: no se crea una fila repetida, se cuenta como una
  // visita adicional sobre el registro que ya estaba.
  if (dbDuplicateNumbers.size > 0) {
    await supabase.rpc("increment_collection_visits", {
      p_client_id: clientId,
      p_service_numbers: Array.from(dbDuplicateNumbers),
    });
  }

  const rejectedRows = [
    ...invalidRows.map((row) => ({ row, reasons: row.errors })),
    ...dbDuplicateRows.map((row) => ({
      row,
      reasons: [`Guía ${row.service_number} ya existía: se registró como una visita adicional, no se creó de nuevo`],
    })),
  ];

  let createdCount = 0;
  const failedDuringInsert: { row: (typeof toInsert)[number]; reasons: string[] }[] = [];

  for (let i = 0; i < toInsert.length; i += INSERT_CHUNK_SIZE) {
    const chunk = toInsert.slice(i, i + INSERT_CHUNK_SIZE);
    const { error } = await supabase.from("collections").insert(
      chunk.map((row) => ({
        client_id: clientId,
        service_number: row.service_number,
        client_name: row.client_name,
        city_id: row.city_id,
        cedi_code: row.cedi_code,
        cedi_name: row.cedi_name,
        service_address: row.service_address,
        service_date: row.service_date,
        load_type_id: row.load_type_id,
        driver_name: row.driver_name,
        client_document: row.client_document,
        collection_amount: row.collection_amount,
      })),
    );

    if (error) {
      chunk.forEach((row) => failedDuringInsert.push({ row, reasons: [error.message] }));
    } else {
      createdCount += chunk.length;
    }
  }

  const allRejected = [...rejectedRows, ...failedDuringInsert];

  const { data: batch } = await supabase
    .from("import_batches")
    .insert({
      module: "recoleccion",
      user_id: user.userId,
      total_received: parsedRows.length,
      total_success: createdCount,
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

  revalidatePath("/recoleccion");

  return {
    success: true,
    summary: {
      total: parsedRows.length,
      created: createdCount,
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

export async function createCollection(input: unknown): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user || !can(user.permissions, "recoleccion.create")) {
    return { success: false, message: "No tienes permiso para crear recolecciones." };
  }

  const parsed = collectionFormSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("collections").insert(normalizeCollectionInput(parsed.data));

  if (error) {
    const message = error.code === "23505" ? "Ya existe una recolección con ese número de servicio para este cliente." : error.message;
    return { success: false, message };
  }

  revalidatePath("/recoleccion");
  return { success: true };
}

export async function updateCollection(id: string, input: unknown): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user || !can(user.permissions, "recoleccion.edit")) {
    return { success: false, message: "No tienes permiso para editar recolecciones." };
  }

  const parsed = collectionFormSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("collections")
    .update(normalizeCollectionInput(parsed.data))
    .eq("id", id);

  if (error) {
    const message = error.code === "23505" ? "Ya existe una recolección con ese número de servicio para este cliente." : error.message;
    return { success: false, message };
  }

  revalidatePath("/recoleccion");
  return { success: true };
}

export async function deleteCollection(id: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user || !can(user.permissions, "recoleccion.delete")) {
    return { success: false, message: "No tienes permiso para eliminar recolecciones." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("collections")
    .update({ deleted_at: new Date().toISOString(), deleted_by: user.userId })
    .eq("id", id);

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath("/recoleccion");
  return { success: true };
}

export async function bulkDeleteCollections(ids: string[]): Promise<BulkActionResult> {
  const user = await getCurrentUser();
  if (!user || !can(user.permissions, "recoleccion.delete")) {
    return { success: false, message: "No tienes permiso para eliminar recolecciones." };
  }
  if (ids.length === 0) {
    return { success: false, message: "No hay registros seleccionados." };
  }

  const supabase = await createClient();
  const { error, count } = await supabase
    .from("collections")
    .update({ deleted_at: new Date().toISOString(), deleted_by: user.userId }, { count: "exact" })
    .in("id", ids)
    .is("deleted_at", null);

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath("/recoleccion");
  return { success: true, affected: count ?? ids.length };
}

export async function getMatchingIds(filters: CollectionsFilters): Promise<string[]> {
  const user = await getCurrentUser();
  if (!user || !can(user.permissions, "recoleccion.view")) return [];
  return getMatchingCollectionIds(filters);
}
