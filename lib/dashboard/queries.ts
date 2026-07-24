import { createClient } from "@/lib/supabase/server";
import type { DashboardDetailRow, DashboardDateRow } from "./types";

export async function getDashboardOperacion(dateFrom: string, dateTo: string) {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("dashboard_operacion_detail", {
    p_date_from: dateFrom,
    p_date_to: dateTo,
  });

  const detailRows = (data ?? []) as DashboardDetailRow[];

  return { detailRows, error };
}

/** Agrupa el detalle plano (fecha+cliente+ciudad) en filas por fecha con desglose por ciudad. */
export function buildDateRows(detailRows: DashboardDetailRow[]): DashboardDateRow[] {
  const byDate = new Map<string, DashboardDetailRow[]>();
  for (const row of detailRows) {
    const list = byDate.get(row.operation_date) ?? [];
    list.push(row);
    byDate.set(row.operation_date, list);
  }

  const result: DashboardDateRow[] = [];

  for (const [date, rows] of byDate) {
    const totalsByClient: DashboardDateRow["totalsByClient"] = {};
    const byCity = new Map<string, DashboardDetailRow[]>();

    for (const row of rows) {
      const current = totalsByClient[row.client_id] ?? { automatic: 0, manual: 0 };
      current.automatic += row.automatic_count;
      current.manual += row.manual_quantity;
      totalsByClient[row.client_id] = current;

      const cityList = byCity.get(row.city_id) ?? [];
      cityList.push(row);
      byCity.set(row.city_id, cityList);
    }

    const total = Object.values(totalsByClient).reduce((sum, v) => sum + v.automatic + v.manual, 0);

    const cities = Array.from(byCity.entries()).map(([cityId, cityRows]) => {
      const cityTotalsByClient: DashboardDateRow["totalsByClient"] = {};
      for (const row of cityRows) {
        const current = cityTotalsByClient[row.client_id] ?? { automatic: 0, manual: 0 };
        current.automatic += row.automatic_count;
        current.manual += row.manual_quantity;
        cityTotalsByClient[row.client_id] = current;
      }
      const cityTotal = Object.values(cityTotalsByClient).reduce((sum, v) => sum + v.automatic + v.manual, 0);
      return { cityId, totalsByClient: cityTotalsByClient, total: cityTotal };
    });

    result.push({ date, totalsByClient, total, cities });
  }

  return result.sort((a, b) => (a.date < b.date ? 1 : -1));
}
