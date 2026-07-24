// Tipo de Servicio es una vista filtrada de Conciliación (reconciliations):
// el mismo registro, porque la fecha de servicio real es la que trae la
// conciliación. Se muestra con su campo propio (si ya fue Verificado).
export type BillingStatus = "verificado" | "no_verificado";

export type ServiceTypeViewRow = {
  id: string;
  service_number: string;
  client_id: string | null;
  client_name: string | null;
  cedi_code: string | null;
  cedi_name: string | null;
  service_address: string | null;
  service_date: string | null;
  city_id: string | null;
  load_type_id: string | null;
  client_document: string | null;
  collection_amount: number;
  billing_status: BillingStatus;
  billing_reverted_reason: string | null;
  created_at: string;
  load_type: { name: string } | null;
  created_by_profile: { full_name: string } | null;
};

export type ServiceTypeFilters = {
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  clientId?: string;
  cityId?: string;
  loadTypeIds?: string[];
  billingStatus?: BillingStatus;
};

export type ServiceTypeSort = {
  column: "service_date" | "service_number" | "collection_amount" | "created_at";
  direction: "asc" | "desc";
};

export const DEFAULT_PAGE_SIZE = 25;
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
