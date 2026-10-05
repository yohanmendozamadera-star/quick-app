import { createClient } from "@/lib/supabase/server";
import type { RecaudoRow } from "./types";

export async function getRecaudos(clientId: string, dateFrom: string, dateTo: string, cityId?: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("recaudos_resumen", {
    p_client_id: clientId, p_date_from: dateFrom, p_date_to: dateTo, p_city_id: cityId || null,
  });
  return { rows: (data ?? []) as RecaudoRow[], error };
}
