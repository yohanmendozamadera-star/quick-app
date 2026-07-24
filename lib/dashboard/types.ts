export type DashboardDetailRow = {
  operation_date: string;
  client_id: string;
  city_id: string;
  automatic_count: number;
  manual_quantity: number;
};

export type DashboardFilters = {
  dateFrom: string;
  dateTo: string;
};

/** Una fila de la tabla principal: una fecha, con el total por cliente. */
export type DashboardDateRow = {
  date: string;
  totalsByClient: Record<string, { automatic: number; manual: number }>;
  total: number;
  /** Detalle por ciudad para el desplegable de esa fecha. */
  cities: {
    cityId: string;
    totalsByClient: Record<string, { automatic: number; manual: number }>;
    total: number;
  }[];
};
