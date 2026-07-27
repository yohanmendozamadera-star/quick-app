export type PazSalvoDocumentType = "paz_y_salvo" | "compromiso";

export type PazSalvoDetailRow = {
  period: string;
  city_id: string;
  cedi_code: string;
  cedi_name: string | null;
  total_count: number;
  pending_count: number;
};

export type PazSalvoFilters = {
  monthFrom: string;
  monthTo: string;
  cityId?: string;
};

export type PazSalvoDocumentRow = {
  id: string;
  cedi_code: string;
  period: string;
  document_type: PazSalvoDocumentType;
  storage_path: string;
  file_name: string;
  uploaded_at: string;
};

export type PazSalvoCediRow = {
  cediCode: string;
  cediName: string | null;
  totalCount: number;
  pendingCount: number;
  document: {
    fileName: string;
    storagePath: string;
    uploadedAt: string;
    documentType: PazSalvoDocumentType;
  } | null;
};

export type PazSalvoCityRow = {
  cityId: string;
  cedis: PazSalvoCediRow[];
};

export type PazSalvoPeriodRow = {
  period: string;
  cities: PazSalvoCityRow[];
};
