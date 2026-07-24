"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, can } from "@/lib/permissions";
import type { CatalogOption } from "./queries";

export type CreateCatalogOptionResult =
  | { success: true; option: CatalogOption }
  | { success: false; message: string };

/**
 * Alta rápida de un valor de catálogo (coordinador/CENLOG) desde el propio
 * formulario que lo necesita, sin pasar por la administración de catálogos.
 * Permitido a quien puede crear el registro que lo usa (no exige
 * config.manage, que sigue siendo el único que puede editar/eliminar).
 */
async function createCatalogOption(table: "coordinators" | "cenlogs", name: string): Promise<CreateCatalogOptionResult> {
  const user = await getCurrentUser();
  if (!user || !can(user.permissions, "adicionales.create")) {
    return { success: false, message: "No tienes permiso para agregar valores nuevos." };
  }

  const trimmed = name.trim();
  if (!trimmed) {
    return { success: false, message: "El nombre no puede estar vacío." };
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from(table)
    .insert({ name: trimmed })
    .select("id, name")
    .single();

  if (error) {
    if (error.code === "23505") {
      const { data: existing } = await supabase
        .from(table)
        .select("id, name")
        .ilike("name", trimmed)
        .single();
      if (existing) return { success: true, option: existing as CatalogOption };
      return { success: false, message: "Ya existe un valor con ese nombre." };
    }
    return { success: false, message: error.message };
  }

  return { success: true, option: data as CatalogOption };
}

export async function createCoordinator(name: string) {
  return createCatalogOption("coordinators", name);
}

export async function createCenlog(name: string) {
  return createCatalogOption("cenlogs", name);
}
