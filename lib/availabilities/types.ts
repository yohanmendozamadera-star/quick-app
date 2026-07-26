export type AvailabilityStatus = "registrado" | "aprobado" | "autorizado";

export type AvailabilityRow = {
  id: string;
  client_id: string;
  service_type_id: string;
  city_id: string;
  quicker_name: string;
  cedula: string;
  date: string;
  payment: number;
  concept: string | null;
  order_number: string;
  observation: string | null;
  status: AvailabilityStatus;
  created_at: string;
  client: { name: string } | null;
  service_type: { name: string } | null;
  city: { name: string } | null;
  created_by_profile: { full_name: string } | null;
};

export type AvailabilityFilters = {
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  clientId?: string;
  serviceTypeId?: string;
  cityId?: string;
  status?: AvailabilityStatus;
};

export type AvailabilitySort = {
  column: "date" | "payment" | "created_at";
  direction: "asc" | "desc";
};

export const DEFAULT_PAGE_SIZE = 25;
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export const STATUS_OPTIONS: { value: AvailabilityStatus; label: string }[] = [
  { value: "registrado", label: "Registrado" },
  { value: "aprobado", label: "Aprobado" },
  { value: "autorizado", label: "Autorizado" },
];
