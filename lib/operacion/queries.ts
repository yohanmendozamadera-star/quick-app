import { createClient } from "@/lib/supabase/server";
import type { OperacionCityRow, OperacionFilters } from "./types";

export async function getOperacionResumen(filters: OperacionFilters) {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("operacion_resumen", {
    p_date_from: filters.dateFrom,
    p_date_to: filters.dateTo,
    p_client_id: filters.clientId || null,
  });

  const rows: OperacionCityRow[] = ((data ?? []) as {
    city_id: string;
    recoleccion_count: number;
    no_conciliados_count: number;
    tipo_servicio_count: number;
    disponibilidad_count: number;
    adicionales_count: number;
  }[]).map((r) => ({
    cityId: r.city_id,
    recoleccion: Number(r.recoleccion_count ?? 0),
    noConciliados: Number(r.no_conciliados_count ?? 0),
    tipoServicio: Number(r.tipo_servicio_count ?? 0),
    disponibilidad: Number(r.disponibilidad_count ?? 0),
    adicionales: Number(r.adicionales_count ?? 0),
  }));

  return { rows, error };
}
