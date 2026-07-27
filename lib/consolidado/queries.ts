import { createClient } from "@/lib/supabase/server";
import type { ConsolidadoDetailRow, ConsolidadoDateRow, ConsolidadoFilters } from "./types";

export async function getConsolidadoResumen(clientId: string, filters: ConsolidadoFilters) {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("consolidado_resumen", {
    p_client_id: clientId,
    p_date_from: filters.dateFrom,
    p_date_to: filters.dateTo,
    p_city_id: filters.cityId || null,
  });

  return { detailRows: (data ?? []) as ConsolidadoDetailRow[], error };
}

/** Agrupa el detalle plano (fecha+ciudad+cedi) en filas por fecha con desglose por ciudad y cedi. */
export function buildConsolidadoDateRows(detailRows: ConsolidadoDetailRow[]): ConsolidadoDateRow[] {
  const byDate = new Map<string, ConsolidadoDetailRow[]>();
  for (const row of detailRows) {
    const list = byDate.get(row.reconciliation_date) ?? [];
    list.push(row);
    byDate.set(row.reconciliation_date, list);
  }

  const result: ConsolidadoDateRow[] = [];

  for (const [date, rows] of byDate) {
    const byCity = new Map<string, ConsolidadoDetailRow[]>();
    for (const row of rows) {
      const list = byCity.get(row.city_id) ?? [];
      list.push(row);
      byCity.set(row.city_id, list);
    }

    const cities = Array.from(byCity.entries()).map(([cityId, cityRows]) => ({
      cityId,
      cedis: cityRows.map((r) => ({
        cediCode: r.cedi_code,
        cediName: r.cedi_name,
        totalCount: Number(r.total_count ?? 0),
        totalAmount: Number(r.total_amount ?? 0),
        sinNovedadCount: Number(r.sin_novedad_count ?? 0),
        sinNovedadAmount: Number(r.sin_novedad_amount ?? 0),
        conNovedadCount: Number(r.con_novedad_count ?? 0),
        conNovedadAmount: Number(r.con_novedad_amount ?? 0),
        reprogramadaCount: Number(r.reprogramada_count ?? 0),
        reprogramadaAmount: Number(r.reprogramada_amount ?? 0),
      })),
    }));

    result.push({ date, cities });
  }

  return result.sort((a, b) => (a.date < b.date ? 1 : -1));
}
