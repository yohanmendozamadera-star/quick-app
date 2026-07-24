import { createClient } from "@/lib/supabase/server";
import { getTipoServicioLoadTypes } from "@/lib/catalog/queries";
import type { ServiceTypeViewRow, ServiceTypeFilters, ServiceTypeSort } from "./types";

const SELECT_COLUMNS = `
  id, service_number, client_id, client_name, cedi_code, cedi_name, service_address,
  service_date, city_id, load_type_id, client_document, collection_amount,
  billing_status, billing_reverted_reason, created_at,
  load_type:load_types(name),
  created_by_profile:profiles!reconciliations_created_by_fkey(full_name)
`;

/** Los ids de Neveras/Periferia/Volumen: lo único que puede aparecer en esta vista. */
async function getRelevantLoadTypeIds() {
  const loadTypes = await getTipoServicioLoadTypes();
  return loadTypes.map((l) => l.id);
}

export async function getServiceTypeRecords({
  filters,
  sort,
  page,
  pageSize,
}: {
  filters: ServiceTypeFilters;
  sort: ServiceTypeSort;
  page: number;
  pageSize: number;
}) {
  const supabase = await createClient();
  const relevantLoadTypeIds = await getRelevantLoadTypeIds();

  if (relevantLoadTypeIds.length === 0) {
    return { rows: [] as ServiceTypeViewRow[], count: 0, totals: { count: 0, value: 0 }, error: null };
  }

  let query = supabase
    .from("reconciliations")
    .select(SELECT_COLUMNS, { count: "exact" })
    .is("deleted_at", null)
    .in("load_type_id", relevantLoadTypeIds);

  if (filters.clientId) query = query.eq("client_id", filters.clientId);
  if (filters.cityId) query = query.eq("city_id", filters.cityId);
  if (filters.loadTypeIds?.length) query = query.in("load_type_id", filters.loadTypeIds);
  if (filters.billingStatus) query = query.eq("billing_status", filters.billingStatus);
  if (filters.dateFrom) query = query.gte("service_date", filters.dateFrom);
  if (filters.dateTo) query = query.lte("service_date", filters.dateTo);
  if (filters.search?.trim()) query = query.ilike("service_number", `%${filters.search.trim()}%`);

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, count, error } = await query
    .order(sort.column, { ascending: sort.direction === "asc" })
    .range(from, to);

  const { data: totalsData } = await supabase.rpc("service_type_view_totals", {
    p_relevant_load_type_ids: relevantLoadTypeIds,
    p_search: filters.search || null,
    p_date_from: filters.dateFrom || null,
    p_date_to: filters.dateTo || null,
    p_client_id: filters.clientId || null,
    p_city_id: filters.cityId || null,
    p_load_type_ids: filters.loadTypeIds?.length ? filters.loadTypeIds : null,
    p_billing_status: filters.billingStatus || null,
  });

  const totals = totalsData?.[0] ?? { total_count: 0, total_value: 0 };

  return {
    rows: (data ?? []) as unknown as ServiceTypeViewRow[],
    count: count ?? 0,
    totals: {
      count: Number(totals.total_count ?? 0),
      value: Number(totals.total_value ?? 0),
    },
    error,
  };
}

export async function getMatchingServiceTypeIds(filters: ServiceTypeFilters): Promise<string[]> {
  const supabase = await createClient();
  const relevantLoadTypeIds = await getRelevantLoadTypeIds();
  if (relevantLoadTypeIds.length === 0) return [];

  const { data } = await supabase.rpc("service_type_view_matching_ids", {
    p_relevant_load_type_ids: relevantLoadTypeIds,
    p_search: filters.search || null,
    p_date_from: filters.dateFrom || null,
    p_date_to: filters.dateTo || null,
    p_client_id: filters.clientId || null,
    p_city_id: filters.cityId || null,
    p_load_type_ids: filters.loadTypeIds?.length ? filters.loadTypeIds : null,
    p_billing_status: filters.billingStatus || null,
  });
  return (data ?? []) as string[];
}
