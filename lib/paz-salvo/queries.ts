import { createClient } from "@/lib/supabase/server";
import type { PazSalvoDetailRow, PazSalvoDocumentRow, PazSalvoFilters, PazSalvoPeriodRow } from "./types";

export async function getPazSalvoResumen(clientId: string, filters: PazSalvoFilters) {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("paz_salvo_resumen", {
    p_client_id: clientId,
    p_month_from: filters.monthFrom,
    p_month_to: filters.monthTo,
    p_city_id: filters.cityId || null,
  });

  return { detailRows: (data ?? []) as PazSalvoDetailRow[], error };
}

export async function getPazSalvoDocuments(clientId: string): Promise<PazSalvoDocumentRow[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("paz_salvo_documents")
    .select("id, cedi_code, period, document_type, storage_path, file_name, uploaded_at")
    .eq("client_id", clientId)
    .is("deleted_at", null);

  return (data ?? []) as PazSalvoDocumentRow[];
}

/** Agrupa el detalle plano (mes+ciudad+cedi) en filas por mes con desglose por ciudad y cedi. */
export function buildPazSalvoPeriodRows(
  detailRows: PazSalvoDetailRow[],
  documents: PazSalvoDocumentRow[],
): PazSalvoPeriodRow[] {
  const docByKey = new Map<string, PazSalvoDocumentRow>();
  for (const doc of documents) {
    docByKey.set(`${doc.cedi_code}|${doc.period}`, doc);
  }

  const byPeriod = new Map<string, PazSalvoDetailRow[]>();
  for (const row of detailRows) {
    const list = byPeriod.get(row.period) ?? [];
    list.push(row);
    byPeriod.set(row.period, list);
  }

  const result: PazSalvoPeriodRow[] = [];

  for (const [period, rows] of byPeriod) {
    const byCity = new Map<string, PazSalvoDetailRow[]>();
    for (const row of rows) {
      const list = byCity.get(row.city_id) ?? [];
      list.push(row);
      byCity.set(row.city_id, list);
    }

    const cities = Array.from(byCity.entries()).map(([cityId, cityRows]) => ({
      cityId,
      cedis: cityRows.map((r) => {
        const doc = docByKey.get(`${r.cedi_code}|${period}`);
        return {
          cediCode: r.cedi_code,
          cediName: r.cedi_name,
          totalAmount: Number(r.total_amount ?? 0),
          pendingCount: Number(r.pending_count ?? 0),
          pendingAmount: Number(r.pending_amount ?? 0),
          document: doc
            ? {
                fileName: doc.file_name,
                storagePath: doc.storage_path,
                uploadedAt: doc.uploaded_at,
                documentType: doc.document_type,
              }
            : null,
        };
      }),
    }));

    result.push({ period, cities });
  }

  return result.sort((a, b) => (a.period < b.period ? 1 : -1));
}
