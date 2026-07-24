import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type CatalogOption = { id: string; name: string };

async function fetchActive(table: string, scopeFilter?: { column: string; value: string }) {
  const supabase = await createClient();
  let query = supabase.from(table).select("id, name").eq("is_active", true).order("name");
  if (scopeFilter) query = query.eq(scopeFilter.column, scopeFilter.value);
  const { data } = await query;
  return (data ?? []) as CatalogOption[];
}

export const getClients = cache(() => fetchActive("clients"));
export const getCities = cache(() => fetchActive("cities"));
export const getLoadTypes = cache(() => fetchActive("load_types"));
export const getTransportTypes = cache(() => fetchActive("transport_types"));
export const getChargeDescriptions = cache(() => fetchActive("charge_descriptions"));
export const getCoordinators = cache(() => fetchActive("coordinators"));
export const getCenlogs = cache(() => fetchActive("cenlogs"));
export const getNodes = cache(() => fetchActive("nodes"));
export const getKeys = cache(() => fetchActive("keys"));

export const getServiceTypes = cache((scope: "recoleccion" | "adicionales") =>
  fetchActive("service_types", { column: "scope", value: scope }),
);

export type CediOption = {
  id: string;
  code: string;
  name: string;
  city_id: string | null;
  city: { name: string } | null;
};

// Droguerias (catalogo "cedis"): codigo unico globalmente, usado para
// calcular automaticamente ciudad y nombre en Recoleccion y Adicionales.
export const getCedis = cache(async (): Promise<CediOption[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("cedis")
    .select("id, code, name, city_id, city:cities(name)")
    .eq("is_active", true)
    .order("code");
  return (data ?? []) as unknown as CediOption[];
});

export type CatalogOptionWithStatus = CatalogOption & { is_active: boolean };

/** Igual que getCedis, pero incluye inactivas (para administrarlas en Configuraciones). */
export const getAllCedis = cache(async (): Promise<(CediOption & { is_active: boolean })[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("cedis")
    .select("id, code, name, city_id, is_active, city:cities(name)")
    .order("code");
  return (data ?? []) as unknown as (CediOption & { is_active: boolean })[];
});

/** Trae un catálogo simple (nombre + activo) incluyendo inactivos, para Configuraciones. */
async function fetchAll(table: string): Promise<CatalogOptionWithStatus[]> {
  const supabase = await createClient();
  const { data } = await supabase.from(table).select("id, name, is_active").order("name");
  return (data ?? []) as CatalogOptionWithStatus[];
}

export const getAllCities = cache(() => fetchAll("cities"));
export const getAllCoordinators = cache(() => fetchAll("coordinators"));
export const getAllCenlogs = cache(() => fetchAll("cenlogs"));
export const getAllTransportTypes = cache(() => fetchAll("transport_types"));
export const getAllChargeDescriptions = cache(() => fetchAll("charge_descriptions"));

// El módulo Tipo de Servicio solo trabaja con estos 3 tipos de carga
// (Neveras, Periferia, Volumen), aunque el catálogo general de Recolección
// tenga más valores (Entrega, Carga Seca, etc.).
const TIPO_SERVICIO_LOAD_TYPE_NAMES = ["Neveras", "Periferia", "Volumen"];

export const getTipoServicioLoadTypes = cache(async () => {
  const all = await getLoadTypes();
  return all.filter((lt) => TIPO_SERVICIO_LOAD_TYPE_NAMES.includes(lt.name));
});
