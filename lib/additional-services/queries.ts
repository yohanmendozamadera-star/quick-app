import { createClient } from "@/lib/supabase/server";
import type { AdditionalServiceRow, AdditionalServiceFilters, AdditionalServiceSort } from "./types";

const SELECT_COLUMNS = `
  id, coordinator_id, cenlog_id, cedi_id, service_type_id, resources_count_range, resource_group_id,
  resource_name, resource_document, plate, service_date, transport_type_id, charge_description_id,
  start_time, end_time, services_count, delivery_support_note, client_authorization_note,
  status, reverted_reason, created_at,
  coordinator:coordinators(name),
  cenlog:cenlogs(name),
  cedi:cedis(code, name, city:cities(name)),
  service_type:service_types(name),
  transport_type:transport_types(name),
  charge_description:charge_descriptions(name),
  created_by_profile:profiles!additional_services_created_by_fkey(full_name)
`;

function applyFilters<T>(query: T, filters: AdditionalServiceFilters) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q = query as any;
  if (filters.coordinatorId) q = q.eq("coordinator_id", filters.coordinatorId);
  if (filters.cenlogId) q = q.eq("cenlog_id", filters.cenlogId);
  if (filters.serviceTypeId) q = q.eq("service_type_id", filters.serviceTypeId);
  if (filters.chargeDescriptionId) q = q.eq("charge_description_id", filters.chargeDescriptionId);
  if (filters.status) q = q.eq("status", filters.status);
  if (filters.dateFrom) q = q.gte("service_date", filters.dateFrom);
  if (filters.dateTo) q = q.lte("service_date", filters.dateTo);
  if (filters.search?.trim()) {
    const term = filters.search.trim();
    q = q.or(`resource_name.ilike.%${term}%,resource_document.ilike.%${term}%,plate.ilike.%${term}%`);
  }
  return q;
}

export async function getAdditionalServices({
  filters,
  sort,
  page,
  pageSize,
}: {
  filters: AdditionalServiceFilters;
  sort: AdditionalServiceSort;
  page: number;
  pageSize: number;
}) {
  const supabase = await createClient();

  let query = supabase
    .from("additional_services")
    .select(SELECT_COLUMNS, { count: "exact" })
    .is("deleted_at", null);
  query = applyFilters(query, filters);

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, count, error } = await query
    .order(sort.column, { ascending: sort.direction === "asc" })
    .range(from, to);

  const { data: totalsData } = await supabase.rpc("additional_services_totals", {
    p_search: filters.search || null,
    p_date_from: filters.dateFrom || null,
    p_date_to: filters.dateTo || null,
    p_coordinator_id: filters.coordinatorId || null,
    p_cenlog_id: filters.cenlogId || null,
    p_service_type_id: filters.serviceTypeId || null,
    p_charge_description_id: filters.chargeDescriptionId || null,
    p_status: filters.status || null,
  });

  const totals = totalsData?.[0] ?? { total_count: 0, total_services: 0 };

  return {
    rows: (data ?? []) as unknown as AdditionalServiceRow[],
    count: count ?? 0,
    totals: {
      count: Number(totals.total_count ?? 0),
      services: Number(totals.total_services ?? 0),
    },
    error,
  };
}

export async function getMatchingAdditionalServiceIds(filters: AdditionalServiceFilters): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("additional_services_matching_ids", {
    p_search: filters.search || null,
    p_date_from: filters.dateFrom || null,
    p_date_to: filters.dateTo || null,
    p_coordinator_id: filters.coordinatorId || null,
    p_cenlog_id: filters.cenlogId || null,
    p_service_type_id: filters.serviceTypeId || null,
    p_charge_description_id: filters.chargeDescriptionId || null,
    p_status: filters.status || null,
  });
  return (data ?? []) as string[];
}
