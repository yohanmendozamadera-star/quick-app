export type MatchStatus = "matched" | "unmatched";

export type ReconciliationRow = {
  id: string;
  service_number: string;
  client_id: string | null;
  client_name: string | null;
  novedad: string | null;
  city_id: string | null;
  cedi_code: string | null;
  cedi_name: string | null;
  service_address: string | null;
  service_date: string | null;
  load_type_id: string | null;
  client_document: string | null;
  collection_amount: number;
  reconciliation_date: string;
  matched_collection_id: string | null;
  match_status: MatchStatus;
  created_at: string;
  client: { name: string } | null;
  city: { name: string } | null;
  load_type: { name: string } | null;
  created_by_profile: { full_name: string } | null;
};

export type ReconciliationsFilters = {
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  clientId?: string;
  cityId?: string;
  cediCode?: string;
};

export type ReconciliationsSort = {
  column: "service_date" | "service_number" | "collection_amount" | "reconciliation_date";
  direction: "asc" | "desc";
};

export const DEFAULT_PAGE_SIZE = 25;
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
