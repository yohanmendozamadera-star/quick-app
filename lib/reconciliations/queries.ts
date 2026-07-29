import { createClient } from "@/lib/supabase/server";
import type { ReconciliationRow, ReconciliationsFilters, ReconciliationsSort } from "./types";

const SELECT_COLUMNS = `
  id, service_number, client_id, client_name, novedad, city_id, cedi_code, cedi_name,
  service_address, service_date, load_type_id, client_document, collection_amount, reconciliation_date,
  matched_collection_id, match_status, created_at,
  client:clients(name),
  city:cities(name),
  load_type:load_types(name),
  created_by_profile:profiles!reconciliations_created_by_fkey(full_name)
`;

export async function getReconciliations({
  filters,
  sort,
  page,
  pageSize,
}: {
  filters: ReconciliationsFilters;
  sort: ReconciliationsSort;
  page: number;
  pageSize: number;
}) {
  const supabase = await createClient();

  let query = supabase
    .from("reconciliations")
    .select(SELECT_COLUMNS, { count: "exact" })
    .is("deleted_at", null);

  if (filters.clientId) query = query.eq("client_id", filters.clientId);
  if (filters.cityId) query = query.eq("city_id", filters.cityId);
  if (filters.cediName) query = query.eq("cedi_name", filters.cediName);
  // El filtro de fecha es la fecha de conciliación (cuándo se cargó el
  // archivo), no la fecha de servicio — así "hoy" trae lo conciliado hoy.
  if (filters.dateFrom) query = query.gte("reconciliation_date", filters.dateFrom);
  if (filters.dateTo) query = query.lte("reconciliation_date", filters.dateTo);
  if (filters.search?.trim()) {
    const term = filters.search.trim();
    query = query.or(
      `service_number.ilike.%${term}%,client_name.ilike.%${term}%,client_document.ilike.%${term}%,cedi_name.ilike.%${term}%`,
    );
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, count, error } = await query
    .order(sort.column, { ascending: sort.direction === "asc" })
    .range(from, to);

  const { data: totalsData } = await supabase.rpc("reconciliations_totals", {
    p_search: filters.search || null,
    p_reconciliation_date_from: filters.dateFrom || null,
    p_reconciliation_date_to: filters.dateTo || null,
    p_client_id: filters.clientId || null,
    p_city_id: filters.cityId || null,
    p_cedi_name: filters.cediName || null,
  });

  const totals = totalsData?.[0] ?? { total_count: 0, total_amount: 0 };

  return {
    rows: (data ?? []) as unknown as ReconciliationRow[],
    count: count ?? 0,
    totals: {
      count: Number(totals.total_count ?? 0),
      amount: Number(totals.total_amount ?? 0),
    },
    error,
  };
}

export async function getMatchingReconciliationIds(filters: ReconciliationsFilters): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("reconciliations_matching_ids", {
    p_search: filters.search || null,
    p_reconciliation_date_from: filters.dateFrom || null,
    p_reconciliation_date_to: filters.dateTo || null,
    p_client_id: filters.clientId || null,
    p_city_id: filters.cityId || null,
    p_cedi_name: filters.cediName || null,
  });
  return (data ?? []) as string[];
}

/** Nombres de CEDI distintos que aparecen en los datos, para poblar el filtro "Nodo" sin depender del catálogo de Droguerías. */
export async function getDistinctCediNames(clientId?: string, cityId?: string): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("reconciliations_distinct_cedi_names", {
    p_client_id: clientId || null,
    p_city_id: cityId || null,
  });
  return (data ?? []) as string[];
}
