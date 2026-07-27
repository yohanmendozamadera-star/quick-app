import ExcelJS from "exceljs";
import { getCurrentUser, can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { getClients, getCities, getTipoServicioLoadTypes } from "@/lib/catalog/queries";
import { formatDate, formatDateTime, getTodayBogota } from "@/lib/format";
import type { ServiceTypeViewRow, ServiceTypeFilters, ServiceTypeSort } from "@/lib/service-types/types";

const SELECT_COLUMNS = `
  id, service_number, client_id, client_name, cedi_code, cedi_name, service_address,
  service_date, city_id, load_type_id, client_document, collection_amount,
  billing_status, billing_reverted_reason, created_at,
  load_type:load_types(name),
  created_by_profile:profiles!reconciliations_created_by_fkey(full_name)
`;

const SORTABLE_COLUMNS = new Set(["service_date", "service_number", "collection_amount", "created_at"]);
const MAX_EXPORT_ROWS = 50000;
const BATCH_SIZE = 1000;

const STATUS_LABELS: Record<string, string> = {
  verificado: "Verificado",
  no_verificado: "No verificado",
};

function str(searchParams: URLSearchParams, key: string) {
  return searchParams.get(key) ?? undefined;
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !can(user.permissions, "tipo_servicio.export")) {
    return new Response("No autorizado", { status: 403 });
  }

  const { searchParams } = new URL(request.url);

  const rawSort = str(searchParams, "sort");
  const sort: ServiceTypeSort = {
    column: (rawSort && SORTABLE_COLUMNS.has(rawSort) ? rawSort : "service_date") as ServiceTypeSort["column"],
    direction: str(searchParams, "dir") === "asc" ? "asc" : "desc",
  };

  const loadTypeParam = str(searchParams, "loadType");
  const filters: ServiceTypeFilters = {
    search: str(searchParams, "q"),
    dateFrom: str(searchParams, "from"),
    dateTo: str(searchParams, "to"),
    clientId: str(searchParams, "client"),
    cityId: str(searchParams, "city"),
    loadTypeIds: loadTypeParam ? [loadTypeParam] : undefined,
    billingStatus: str(searchParams, "status") as ServiceTypeFilters["billingStatus"],
  };

  const supabase = await createClient();
  const [clients, cities, loadTypes] = await Promise.all([
    getClients(),
    getCities(),
    getTipoServicioLoadTypes(),
  ]);
  const relevantLoadTypeIds = loadTypes.map((l) => l.id);

  const rows: ServiceTypeViewRow[] = [];
  let from = 0;
  let truncated = false;

  if (relevantLoadTypeIds.length > 0) {
    while (from < MAX_EXPORT_ROWS) {
      let query = supabase
        .from("reconciliations")
        .select(SELECT_COLUMNS)
        .is("deleted_at", null)
        .in("load_type_id", relevantLoadTypeIds);

      if (filters.clientId) query = query.eq("client_id", filters.clientId);
      if (filters.cityId) query = query.eq("city_id", filters.cityId);
      if (filters.loadTypeIds?.length) query = query.in("load_type_id", filters.loadTypeIds);
      if (filters.billingStatus) query = query.eq("billing_status", filters.billingStatus);
      if (filters.dateFrom) query = query.gte("service_date", filters.dateFrom);
      if (filters.dateTo) query = query.lte("service_date", filters.dateTo);
      if (filters.search?.trim()) query = query.ilike("service_number", `%${filters.search.trim()}%`);

      const to = Math.min(from + BATCH_SIZE, MAX_EXPORT_ROWS) - 1;
      const { data, error } = await query
        .order(sort.column, { ascending: sort.direction === "asc" })
        .range(from, to);

      if (error) {
        return new Response(`Error generando el archivo: ${error.message}`, { status: 500 });
      }

      rows.push(...((data ?? []) as unknown as ServiceTypeViewRow[]));

      if (!data || data.length < to - from + 1) break;
      from += BATCH_SIZE;
      if (rows.length >= MAX_EXPORT_ROWS) {
        truncated = true;
        break;
      }
    }
  }

  const workbook = new ExcelJS.Workbook();

  const dataSheet = workbook.addWorksheet("Datos");
  dataSheet.columns = [
    { header: "Número del servicio", key: "service_number", width: 18 },
    { header: "Nombre cliente", key: "client_name", width: 22 },
    { header: "Código CEDI", key: "cedi_code", width: 12 },
    { header: "Nombre CEDI", key: "cedi_name", width: 28 },
    { header: "Dirección servicio", key: "service_address", width: 26 },
    { header: "Fecha servicio", key: "service_date", width: 16 },
    { header: "Tipo de servicio", key: "load_type", width: 14 },
    { header: "Documento cliente", key: "client_document", width: 18 },
    { header: "Recaudo", key: "collection_amount", width: 14 },
    { header: "Estado", key: "status", width: 14 },
    { header: "Motivo reversión", key: "reverted_reason", width: 24 },
    { header: "Registrado por", key: "created_by", width: 22 },
    { header: "Fecha de registro", key: "created_at", width: 18 },
  ];
  dataSheet.getRow(1).font = { bold: true };
  dataSheet.autoFilter = { from: "A1", to: "M1" };

  let totalValue = 0;
  for (const row of rows) {
    totalValue += row.collection_amount ?? 0;
    dataSheet.addRow({
      service_number: row.service_number,
      client_name: row.client_name ?? "",
      cedi_code: row.cedi_code ?? "",
      cedi_name: row.cedi_name ?? "",
      service_address: row.service_address ?? "",
      service_date: formatDate(row.service_date),
      load_type: row.load_type?.name ?? "",
      client_document: row.client_document ?? "",
      collection_amount: row.collection_amount ?? 0,
      status: STATUS_LABELS[row.billing_status] ?? row.billing_status,
      reverted_reason: row.billing_reverted_reason ?? "",
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
  const loadTypeName = filters.loadTypeIds?.length
    ? loadTypes.find((l) => l.id === filters.loadTypeIds?.[0])?.name ?? "Todos"
    : "Todos";
  const statusLabel = filters.billingStatus ? STATUS_LABELS[filters.billingStatus] : "Todos";

  const summaryRows: [string, string | number][] = [
    ["Reporte", "Tipo de Servicio"],
    ["Generado por", user.fullName],
    ["Fecha de descarga", formatDateTime(new Date().toISOString())],
    ["Total de registros", rows.length],
    ["Recaudo total", totalValue],
    ["", ""],
    ["Filtros aplicados", ""],
    ["Buscar (número de servicio)", filters.search || "(ninguno)"],
    ["Desde", filters.dateFrom ? formatDate(filters.dateFrom) : "(sin límite)"],
    ["Hasta", filters.dateTo ? formatDate(filters.dateTo) : "(sin límite)"],
    ["Cliente", clientName],
    ["Ciudad", cityName],
    ["Tipo de servicio", loadTypeName],
    ["Estado", statusLabel],
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
  const fileName = `tipo_servicio_${getTodayBogota()}.xlsx`;

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
