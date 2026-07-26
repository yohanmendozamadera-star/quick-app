"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, can } from "@/lib/permissions";
import { getCities } from "@/lib/catalog/queries";
import { parseCedisBulkText } from "@/lib/config/cedis-bulk-parse";

export type ActionResult = { success: true } | { success: false; message: string };

export type BulkImportResult =
  | {
      success: true;
      summary: { total: number; created: number; updated: number; rejected: number };
      errorRows: { rowNumber: number; raw: string; reasons: string[] }[];
    }
  | { success: false; message: string };

function revalidate() {
  revalidatePath("/configuraciones");
}

async function requireConfigManage() {
  const user = await getCurrentUser();
  if (!user || !can(user.permissions, "config.manage")) {
    return null;
  }
  return user;
}

// ---------- Droguerías (cedis: código único global + ciudad) ----------

export async function createCedi(input: { code: string; name: string; city_id: string }): Promise<ActionResult> {
  const user = await requireConfigManage();
  if (!user) return { success: false, message: "No tienes permiso para administrar configuraciones." };

  const code = input.code.trim().toUpperCase();
  const name = input.name.trim();
  if (!code) return { success: false, message: "El código es obligatorio." };
  if (!name) return { success: false, message: "El nombre es obligatorio." };
  if (!input.city_id) return { success: false, message: "La ciudad es obligatoria." };

  const supabase = await createClient();
  const { error } = await supabase.from("cedis").insert({ code, name, city_id: input.city_id });

  if (error) {
    const message = error.code === "23505" ? `Ya existe una droguería con el código ${code}.` : error.message;
    return { success: false, message };
  }

  revalidate();
  return { success: true };
}

export async function updateCedi(
  id: string,
  input: { code: string; name: string; city_id: string },
): Promise<ActionResult> {
  const user = await requireConfigManage();
  if (!user) return { success: false, message: "No tienes permiso para administrar configuraciones." };

  const code = input.code.trim().toUpperCase();
  const name = input.name.trim();
  if (!code) return { success: false, message: "El código es obligatorio." };
  if (!name) return { success: false, message: "El nombre es obligatorio." };
  if (!input.city_id) return { success: false, message: "La ciudad es obligatoria." };

  const supabase = await createClient();
  const { error } = await supabase.from("cedis").update({ code, name, city_id: input.city_id }).eq("id", id);

  if (error) {
    const message = error.code === "23505" ? `Ya existe una droguería con el código ${code}.` : error.message;
    return { success: false, message };
  }

  revalidate();
  return { success: true };
}

export async function setCediActive(id: string, isActive: boolean): Promise<ActionResult> {
  const user = await requireConfigManage();
  if (!user) return { success: false, message: "No tienes permiso para administrar configuraciones." };

  const supabase = await createClient();
  const { error } = await supabase.from("cedis").update({ is_active: isActive }).eq("id", id);

  if (error) return { success: false, message: error.message };

  revalidate();
  return { success: true };
}

export async function bulkImportCedis(rawText: string): Promise<BulkImportResult> {
  const user = await requireConfigManage();
  if (!user) return { success: false, message: "No tienes permiso para administrar configuraciones." };

  const cities = await getCities();
  const parsedRows = parseCedisBulkText(rawText, cities);

  if (parsedRows.length === 0) {
    return { success: false, message: "No se encontró ningún dato para importar." };
  }

  const supabase = await createClient();

  const validRows = parsedRows.filter((row) => row.errors.length === 0);
  const invalidRows = parsedRows.filter((row) => row.errors.length > 0);

  const { data: existing } = await supabase
    .from("cedis")
    .select("code")
    .in(
      "code",
      validRows.map((r) => r.code),
    );
  const existingCodes = new Set((existing ?? []).map((r) => r.code));

  let createdCount = 0;
  let updatedCount = 0;
  const failed: { row: (typeof validRows)[number]; reasons: string[] }[] = [];

  // Se guarda por código: si ya existe, se actualiza (nombre/ciudad pueden
  // cambiar); si no existe, se crea. Así el mismo archivo se puede volver a
  // pegar para corregir datos sin generar duplicados.
  for (const row of validRows) {
    const { error } = await supabase
      .from("cedis")
      .upsert({ code: row.code, name: row.name, city_id: row.city_id, is_active: true }, { onConflict: "code" });

    if (error) {
      failed.push({ row, reasons: [error.message] });
    } else if (existingCodes.has(row.code)) {
      updatedCount += 1;
    } else {
      createdCount += 1;
    }
  }

  revalidate();

  const allRejected = [...invalidRows.map((row) => ({ row, reasons: row.errors })), ...failed];

  return {
    success: true,
    summary: {
      total: parsedRows.length,
      created: createdCount,
      updated: updatedCount,
      rejected: allRejected.length,
    },
    errorRows: allRejected.map(({ row, reasons }) => ({
      rowNumber: row.rowNumber,
      raw: row.raw,
      reasons,
    })),
  };
}

// ---------- Catálogos simples (nombre + activo) ----------

export type SimpleCatalogTable =
  | "cities"
  | "coordinators"
  | "cenlogs"
  | "transport_types"
  | "charge_descriptions"
  | "clients";

const SIMPLE_TABLES = new Set<SimpleCatalogTable>([
  "cities",
  "coordinators",
  "cenlogs",
  "transport_types",
  "charge_descriptions",
  "clients",
]);

function assertSimpleTable(table: string): table is SimpleCatalogTable {
  return SIMPLE_TABLES.has(table as SimpleCatalogTable);
}

export async function createSimpleCatalogItem(table: SimpleCatalogTable, name: string): Promise<ActionResult> {
  const user = await requireConfigManage();
  if (!user) return { success: false, message: "No tienes permiso para administrar configuraciones." };
  if (!assertSimpleTable(table)) return { success: false, message: "Catálogo inválido." };

  const trimmed = name.trim();
  if (!trimmed) return { success: false, message: "El nombre no puede estar vacío." };

  const supabase = await createClient();
  const { error } = await supabase.from(table).insert({ name: trimmed });

  if (error) {
    const message = error.code === "23505" ? "Ya existe un valor con ese nombre." : error.message;
    return { success: false, message };
  }

  revalidate();
  return { success: true };
}

export async function updateSimpleCatalogItem(
  table: SimpleCatalogTable,
  id: string,
  name: string,
): Promise<ActionResult> {
  const user = await requireConfigManage();
  if (!user) return { success: false, message: "No tienes permiso para administrar configuraciones." };
  if (!assertSimpleTable(table)) return { success: false, message: "Catálogo inválido." };

  const trimmed = name.trim();
  if (!trimmed) return { success: false, message: "El nombre no puede estar vacío." };

  const supabase = await createClient();
  const { error } = await supabase.from(table).update({ name: trimmed }).eq("id", id);

  if (error) {
    const message = error.code === "23505" ? "Ya existe un valor con ese nombre." : error.message;
    return { success: false, message };
  }

  revalidate();
  return { success: true };
}

export async function setSimpleCatalogItemActive(
  table: SimpleCatalogTable,
  id: string,
  isActive: boolean,
): Promise<ActionResult> {
  const user = await requireConfigManage();
  if (!user) return { success: false, message: "No tienes permiso para administrar configuraciones." };
  if (!assertSimpleTable(table)) return { success: false, message: "Catálogo inválido." };

  const supabase = await createClient();
  const { error } = await supabase.from(table).update({ is_active: isActive }).eq("id", id);

  if (error) return { success: false, message: error.message };

  revalidate();
  return { success: true };
}
