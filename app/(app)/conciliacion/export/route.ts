import ExcelJS from "exceljs";
import { getCurrentUser, can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { getClients, getCities } from "@/lib/catalog/queries";
import { formatDate, formatDateTime, getTodayBogota } from "@/lib/format";
import type { ReconciliationRow, ReconciliationsFilters, ReconciliationsSort } from "@/lib/reconciliations/types";

const SELECT_COLUMNS = `
  id, service_number, client_id, client_name, novedad, city_id, cedi_code, cedi_name,
  service_address, service_date, load_type_id, client_document, collection_amount, reconciliation_date,
  matched_collection_id, match_status, created_at,
  client:clients(name),
  city:cities(name),
  load_type:load_types(name),
  created_by_profile:profiles!reconciliations_created_by_fkey(full_name)
`;

const SORTABLE_COLUMNS = new Set(["service_date", "service_number", "collection_amount", "reconciliation_date"]);
const MAX_EXPORT_ROWS = 50000;
const BATCH_SIZE = 1000;

const MATCH_LABELS: Record<string, string> = {
  matched: "Conciliado",
  unmatched: "Sin coincidencia",
};

function str(searchParams: URLSearchParams, key: string) {
  return searchParams.get(key) ?? undefined;
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !can(user.permissions, "conciliacion.export")) {
    return new Response("No autorizado", { status: 403 });
  }

  const { searchParams } = new URL(request.url);

  const rawSort = str(searchParams, "sort");
  const sort: ReconciliationsSort = {
    column: (rawSort && SORTABLE_COLUMNS.has(rawSort) ? rawSort : "reconciliation_date") as ReconciliationsSort["column"],
    direction: str(searchParams, "dir") === "asc" ? "asc" : "desc",
  };

  const filters: ReconciliationsFilters = {
    search: str(searchParams, "q"),
    dateFrom: str(searchParams, "cfrom"),
    dateTo: str(searchParams, "cto"),
    clientId: str(searchParams, "client"),
    cityId: str(searchParams, "city"),
    cediCode: str(searchParams, "cedi"),
  };

  const supabase = await createClient();
  const [clients, cities] = await Promise.all([getClients(), getCities()]);

  const rows: ReconciliationRow[] = [];
  let from = 0;
  let truncated = false;

  while (from < MAX_EXPORT_ROWS) {
    let query = supabase.from("reconciliations").select(SELECT_COLUMNS).is("deleted_at", null);

    if (filters.clientId) query = query.eq("client_id", filters.clientId);
    if (filters.cityId) query = query.eq("city_id", filters.cityId);
    if (filters.cediCode) query = query.eq("cedi_code", filters.cediCode);
    if (filters.dateFrom) query = query.gte("reconciliation_date", filters.dateFrom);
    if (filters.dateTo) query = query.lte("reconciliation_date", filters.dateTo);
    if (filters.search?.trim()) {
      const term = filters.search.trim();
      query = query.or(
        `service_number.ilike.%${term}%,client_name.ilike.%${term}%,client_document.ilike.%${term}%,cedi_name.ilike.%${term}%`,
      );
    }

    const to = Math.min(from + BATCH_SIZE, MAX_EXPORT_ROWS) - 1;
    const { data, error } = await query
      .order(sort.column, { ascending: sort.direction === "asc" })
      .range(from, to);

    if (error) {
      return new Response(`Error generando el archivo: ${error.message}`, { status: 500 });
    }

    rows.push(...((data ?? []) as unknown as ReconciliationRow[]));

    if (!data || data.length < to - from + 1) break;
    from += BATCH_SIZE;
    if (rows.length >= MAX_EXPORT_ROWS) {
      truncated = true;
      break;
    }
  }

  const workbook = new ExcelJS.Workbook();

  const dataSheet = workbook.addWorksheet("Datos");
  dataSheet.columns = [
    { header: "N° Servicio", key: "service_number", width: 16 },
    { header: "Nombre del cliente", key: "client_name", width: 22 },
    { header: "Cliente", key: "client", width: 16 },
    { header: "Novedad", key: "novedad", width: 22 },
    { header: "Ciudad", key: "city", width: 14 },
    { header: "Código CEDI", key: "cedi_code", width: 12 },
    { header: "Nombre CEDI", key: "cedi_name", width: 28 },
    { header: "Dirección", key: "service_address", width: 26 },
    { header: "Fecha del servicio", key: "service_date", width: 16 },
    { header: "Tipo de servicio", key: "load_type", width: 14 },
    { header: "Documento del cliente", key: "client_document", width: 18 },
    { header: "Recaudo", key: "collection_amount", width: 14 },
    { header: "Fecha de conciliación", key: "reconciliation_date", width: 18 },
    { header: "Estado del cruce", key: "status", width: 16 },
    { header: "Registrado por", key: "created_by", width: 22 },
    { header: "Fecha de registro", key: "created_at", width: 18 },
  ];
  dataSheet.getRow(1).font = { bold: true };
  dataSheet.autoFilter = { from: "A1", to: "P1" };

  let totalAmount = 0;
  for (const row of rows) {
    totalAmount += row.collection_amount ?? 0;
    dataSheet.addRow({
      service_number: row.service_number,
      client_name: row.client_name ?? "",
      client: row.client?.name ?? "",
      novedad: row.novedad ?? "",
      city: row.city?.name ?? "",
      cedi_code: row.cedi_code ?? "",
      cedi_name: row.cedi_name ?? "",
      service_address: row.service_address ?? "",
      service_date: formatDate(row.service_date),
      load_type: row.load_type?.name ?? "",
      client_document: row.client_document ?? "",
      collection_amount: row.collection_amount ?? 0,
      reconciliation_date: formatDate(row.reconciliation_date),
      status: MATCH_LABELS[row.match_status] ?? row.match_status,
      created_by: row.created_by_profile?.full_name ?? "",
      created_at: formatDateTime(row.created_at),
    });
  }
  dataSheet.getColumn("collection_amount").numFmt = "#,##0";

  const summarySheet = workbook.addWorksheet("Resumen");
  summarySheet.getColumn(1).width = 26;
  summarySheet.getColumn(2).width = 46;

  const clientName = clients.find((c) => c.id === filters.clientId)?.name ?? "Todos";
  const cityName = cities.find((c) => c.id === filters.cityId)?.name ?? "Todas";
  const matchedCount = rows.filter((r) => r.match_status === "matched").length;

  const summaryRows: [string, string | number][] = [
    ["Reporte", "Conciliación"],
    ["Generado por", user.fullName],
    ["Fecha de descarga", formatDateTime(new Date().toISOString())],
    ["Total de registros", rows.length],
    ["Conciliados", matchedCount],
    ["Sin coincidencia", rows.length - matchedCount],
    ["Recaudo total", totalAmount],
    ["", ""],
    ["Filtros aplicados", ""],
    ["Buscar", filters.search || "(ninguno)"],
    ["Fecha de conciliación desde", filters.dateFrom ? formatDate(filters.dateFrom) : "(sin límite)"],
    ["Fecha de conciliación hasta", filters.dateTo ? formatDate(filters.dateTo) : "(sin límite)"],
    ["Cliente", clientName],
    ["Ciudad", cityName],
    ["Nodo (CEDI)", filters.cediCode || "Todos"],
    ["Ordenado por", `${sort.column} (${sort.direction === "asc" ? "ascendente" : "descendente"})`],
  ];
  summaryRows.forEach((r) => summarySheet.addRow(r));
  summarySheet.getColumn(1).font = { bold: true };

  if (truncated) {
    summarySheet.addRow(["", ""]);
    summarySheet.addRow([
      "Aviso",
      `Se alcanzó el límite de ${MAX_EXPORT_ROWS.toLocaleString("es-CO")} registros por descarga. Aplica más filtros para exportar en partes.`,
    ]);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const fileName = `conciliacion_${getTodayBogota()}.xlsx`;

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
