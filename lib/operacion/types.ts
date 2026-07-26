export type OperacionCityRow = {
  cityId: string;
  recoleccion: number;
  noConciliados: number;
  tipoServicio: number;
  disponibilidad: number;
};

export type OperacionFilters = {
  dateFrom: string;
  dateTo: string;
  clientId?: string;
};
