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
        cediName: r.cedi_name,
        recoleccionCount: Number(r.recoleccion_count ?? 0),
        recoleccionAmount: Number(r.recoleccion_amount ?? 0),
        conciliadoCount: Number(r.conciliado_count ?? 0),
        conciliadoAmount: Number(r.conciliado_amount ?? 0),
        pendienteCount: Number(r.pendiente_count ?? 0),
        pendienteAmount: Number(r.pendiente_amount ?? 0),
      })),
    }));

    result.push({ date, cities });
  }

  return result.sort((a, b) => (a.date < b.date ? 1 : -1));
}
