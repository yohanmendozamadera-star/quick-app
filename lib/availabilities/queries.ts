import { createClient } from "@/lib/supabase/server";
import type { AvailabilityRow, AvailabilityFilters, AvailabilitySort } from "./types";

const SELECT_COLUMNS = `
  id, client_id, service_type_id, quicker_name, cedula, date, payment, concept,
  order_number, observation, status, created_at,
  client:clients(name),
  service_type:service_types(name),
  created_by_profile:profiles!availabilities_created_by_fkey(full_name)
`;

function applyFilters<T>(query: T, filters: AvailabilityFilters) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q = query as any;
  if (filters.clientId) q = q.eq("client_id", filters.clientId);
  if (filters.serviceTypeId) q = q.eq("service_type_id", filters.serviceTypeId);
  if (filters.status) q = q.eq("status", filters.status);
  if (filters.dateFrom) q = q.gte("date", filters.dateFrom);
  if (filters.dateTo) q = q.lte("date", filters.dateTo);
  if (filters.search?.trim()) {
    const term = filters.search.trim();
    q = q.or(`quicker_name.ilike.%${term}%,cedula.ilike.%${term}%,order_number.ilike.%${term}%`);
  }
  return q;
}

export async function getAvailabilities({
  filters,
  sort,
  page,
  pageSize,
}: {
  filters: AvailabilityFilters;
  sort: AvailabilitySort;
  page: number;
  pageSize: number;
}) {
  const supabase = await createClient();

  let query = supabase.from("availabilities").select(SELECT_COLUMNS, { count: "exact" }).is("deleted_at", null);
  query = applyFilters(query, filters);

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, count, error } = await query
    .order(sort.column, { ascending: sort.direction === "asc" })
    .range(from, to);

  const { data: totalsData } = await supabase.rpc("availabilities_totals", {
    p_search: filters.search || null,
    p_date_from: filters.dateFrom || null,
    p_date_to: filters.dateTo || null,
    p_client_id: filters.clientId || null,
    p_service_type_id: filters.serviceTypeId || null,
    p_status: filters.status || null,
  });

  const totals = totalsData?.[0] ?? { total_count: 0, total_payment: 0 };

  return {
    rows: (data ?? []) as unknown as AvailabilityRow[],
    count: count ?? 0,
    totals: {
      count: Number(totals.total_count ?? 0),
      payment: Number(totals.total_payment ?? 0),
    },
    error,
  };
}

export async function getMatchingAvailabilityIds(filters: AvailabilityFilters): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("availabilities_matching_ids", {
    p_search: filters.search || null,
    p_date_from: filters.dateFrom || null,
    p_date_to: filters.dateTo || null,
    p_client_id: filters.clientId || null,
    p_service_type_id: filters.serviceTypeId || null,
    p_status: filters.status || null,
  });
  return (data ?? []) as string[];
}
