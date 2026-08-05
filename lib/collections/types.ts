export type ReconciliationStatus = "no_conciliado" | "conciliado";

export type CollectionRow = {
  id: string;
  service_number: string;
  client_id: string;
  client_name: string | null;
  note: string | null;
  driver_name: string | null;
  city_id: string;
  cedi_code: string | null;
  cedi_name: string | null;
  service_address: string | null;
  service_date: string;
  collection_date: string | null;
  load_type_id: string | null;
  client_document: string | null;
  collection_amount: number;
  visits: number;
  reconciliation_status: ReconciliationStatus;
  reconciled_at: string | null;
  created_at: string;
  updated_at: string;
  client: { name: string } | null;
  city: { name: string } | null;
  load_type: { name: string } | null;
  created_by_profile: { full_name: string } | null;
  updated_by_profile: { full_name: string } | null;
};

export type CollectionsFilters = {
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  clientId?: string;
  cityId?: string;
  loadTypeIds?: string[];
  reconciliationStatus?: ReconciliationStatus;
  /** Solo no conciliadas con al menos estos días sin conciliar (3 o 5). */
  opportunityMinDays?: number;
};

export type CollectionsSort = {
  column: "service_date" | "service_number" | "collection_amount" | "created_at";
  direction: "asc" | "desc";
};

export const DEFAULT_PAGE_SIZE = 25;
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
