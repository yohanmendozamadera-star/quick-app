export type ResourcesCountRange = "1-5" | "6+";

export type AdditionalServiceStatus =
  | "pendiente"
  | "reportado"
  | "aprobado"
  | "rechazado"
  | "facturado";

export type AdditionalServiceRow = {
  id: string;
  coordinator_id: string;
  cenlog_id: string | null;
  cedi_id: string;
  service_type_id: string;
  resources_count_range: ResourcesCountRange;
  resource_group_id: string | null;
  resource_name: string | null;
  resource_document: string | null;
  plate: string | null;
  service_date: string;
  transport_type_id: string | null;
  charge_description_id: string | null;
  start_time: string | null;
  end_time: string | null;
  services_count: number;
  delivery_support_note: string | null;
  client_authorization_note: string | null;
  status: AdditionalServiceStatus;
  reverted_reason: string | null;
  created_at: string;
  coordinator: { name: string } | null;
  cenlog: { name: string } | null;
  cedi: { code: string; name: string; city: { name: string } | null } | null;
  service_type: { name: string } | null;
  transport_type: { name: string } | null;
  charge_description: { name: string } | null;
  created_by_profile: { full_name: string } | null;
};

export type AdditionalServiceFilters = {
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  coordinatorId?: string;
  cenlogId?: string;
  serviceTypeId?: string;
  chargeDescriptionId?: string;
  status?: AdditionalServiceStatus;
};

export type AdditionalServiceSort = {
  column: "service_date" | "services_count" | "created_at";
  direction: "asc" | "desc";
};

export const DEFAULT_PAGE_SIZE = 25;
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export const STATUS_OPTIONS: { value: AdditionalServiceStatus; label: string }[] = [
  { value: "pendiente", label: "Pendiente" },
  { value: "reportado", label: "Reportado" },
  { value: "aprobado", label: "Aprobado" },
  { value: "rechazado", label: "Rechazado" },
  { value: "facturado", label: "Facturado" },
];
