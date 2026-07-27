export type ConsolidadoDetailRow = {
  reconciliation_date: string;
  city_id: string;
  cedi_code: string;
  cedi_name: string | null;
  recoleccion_count: number;
  recoleccion_amount: number;
  conciliado_count: number;
  conciliado_amount: number;
  reprogramada_count: number;
  reprogramada_amount: number;
  pendiente_count: number;
  pendiente_amount: number;
};

export type ConsolidadoFilters = {
  dateFrom: string;
  dateTo: string;
  cityId?: string;
};

export type ConsolidadoCediRow = {
  cediCode: string;
  cediName: string | null;
  recoleccionCount: number;
  recoleccionAmount: number;
  conciliadoCount: number;
  conciliadoAmount: number;
  reprogramadaCount: number;
  reprogramadaAmount: number;
  pendienteCount: number;
  pendienteAmount: number;
};

export type ConsolidadoCityRow = {
  cityId: string;
  cedis: ConsolidadoCediRow[];
};

export type ConsolidadoDateRow = {
  date: string;
  cities: ConsolidadoCityRow[];
};
