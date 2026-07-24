import { createClient } from "@/lib/supabase/server";
import type { CollectionRow, CollectionsFilters, CollectionsSort } from "./types";

const SELECT_COLUMNS = `
  id, service_number, client_id, client_name, note, driver_name, city_id, cedi_code, cedi_name, service_address,
  service_date, load_type_id, client_document, collection_amount, visits,
  reconciliation_status, reconciled_at, created_at, updated_at,
  client:clients(name),
  city:cities(name),
  load_type:load_types(name),
  created_by_profile:profiles!collections_created_by_fkey(full_name),
  updated_by_profile:profiles!collections_updated_by_fkey(full_name)
`;

// Ninguna recolección real usa este id, así que sirve como "no encontrar
// nada" cuando el filtro de Oportunidad no matchea ninguna fila (evitar
// pasar un arreglo vacío a .in(), que Supabase interpreta distinto).
const NO_MATCH_ID = "00000000-0000-0000-0000-000000000000";

async function resolveOpportunityIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  filters: CollectionsFilters,
): Promise<string[] | null> {
  // El filtro de Oportunidad depende de la fecha de hoy (no es una columna
  // fija), así que primero se resuelve a una lista de ids en la base de
  // datos y luego se usa para acotar tanto el listado como los totales.
  if (!filters.opportunityMinDays) return null;
  const { data } = await supabase.rpc("collections_opportunity_ids", {
    p_min_days: filters.opportunityMinDays,
  });
  return (data ?? []).length > 0 ? (data as string[]) : [NO_MATCH_ID];
}

export async function getCollections({
  filters,
  sort,
  page,
  pageSize,
}: {
  filters: CollectionsFilters;
  sort: CollectionsSort;
  page: number;
  pageSize: number;
}) {
  const supabase = await createClient();

  const opportunityIds = await resolveOpportunityIds(supabase, filters);

  let query = supabase
    .from("collections")
    .select(SELECT_COLUMNS, { count: "exact" })
    .is("deleted_at", null);

  if (filters.clientId) query = query.eq("client_id", filters.clientId);
  if (filters.cityId) query = query.eq("city_id", filters.cityId);
  if (filters.loadTypeIds?.length) query = query.in("load_type_id", filters.loadTypeIds);
  if (filters.reconciliationStatus) query = query.eq("reconciliation_status", filters.reconciliationStatus);
  if (filters.dateFrom) query = query.gte("service_date", filters.dateFrom);
  if (filters.dateTo) query = query.lte("service_date", filters.dateTo);
  if (opportunityIds) query = query.in("id", opportunityIds);
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

  const { data: totalsData } = await supabase.rpc("collections_totals", {
    p_search: filters.search || null,
    p_date_from: filters.dateFrom || null,
    p_date_to: filters.dateTo || null,
    p_client_id: filters.clientId || null,
    p_city_id: filters.cityId || null,
    p_load_type_ids: filters.loadTypeIds?.length ? filters.loadTypeIds : null,
    p_reconciliation_status: filters.reconciliationStatus || null,
    p_ids: opportunityIds,
  });

  const totals = totalsData?.[0] ?? { total_count: 0, total_amount: 0 };

  return {
    rows: (data ?? []) as unknown as CollectionRow[],
    count: count ?? 0,
    totals: {
      count: Number(totals.total_count ?? 0),
      amount: Number(totals.total_amount ?? 0),
    },
    error,
  };
}

export async function getMatchingCollectionIds(filters: CollectionsFilters): Promise<string[]> {
  const supabase = await createClient();
  const opportunityIds = await resolveOpportunityIds(supabase, filters);

  const { data } = await supabase.rpc("collections_matching_ids", {
    p_search: filters.search || null,
    p_date_from: filters.dateFrom || null,
    p_date_to: filters.dateTo || null,
    p_client_id: filters.clientId || null,
    p_city_id: filters.cityId || null,
    p_load_type_ids: filters.loadTypeIds?.length ? filters.loadTypeIds : null,
    p_reconciliation_status: filters.reconciliationStatus || null,
    p_ids: opportunityIds,
  });

  return (data ?? []) as string[];
}
