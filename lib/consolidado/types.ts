export type ConsolidadoDetailRow = {
  reconciliation_date: string;
  city_id: string;
  cedi_code: string;
  cedi_name: string | null;
  total_count: number;
  total_amount: number;
  sin_novedad_count: number;
  sin_novedad_amount: number;
  con_novedad_count: number;
  con_novedad_amount: number;
  reprogramada_count: number;
  reprogramada_amount: number;
};

export type ConsolidadoFilters = {
  dateFrom: string;
  dateTo: string;
  cityId?: string;
};

export type ConsolidadoCediRow = {
  cediCode: string;
  cediName: string | null;
  totalCount: number;
  totalAmount: number;
  sinNovedadCount: number;
  sinNovedadAmount: number;
  conNovedadCount: number;
  conNovedadAmount: number;
  reprogramadaCount: number;
  reprogramadaAmount: number;
};

export type ConsolidadoCityRow = {
  cityId: string;
  cedis: ConsolidadoCediRow[];
};

export type ConsolidadoDateRow = {
  date: string;
  cities: ConsolidadoCityRow[];
};
