import ExcelJS from "exceljs";
import { getCurrentUser, can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { getClients, getCities, getLoadTypes } from "@/lib/catalog/queries";
import { formatDate, formatDateTime, getTodayBogota } from "@/lib/format";
import { computeOpportunityDays } from "@/lib/collections/opportunity";
import type { CollectionRow, CollectionsFilters, CollectionsSort } from "@/lib/collections/types";

const SELECT_COLUMNS = `
  id, service_number, client_id, client_name, note, driver_name, city_id, cedi_code, cedi_name, service_address,
  service_date, load_type_id, client_document, collection_amount, visits,
  reconciliation_status, reconciled_at, created_at, updated_at,
  client:clients(name),
  city:cities(name),
  load_type:load_types(name),
  created_by_profile:profiles!collections_created_by_fkey(full_name)
`;

const SORTABLE_COLUMNS = new Set(["service_date", "service_number", "collection_amount", "created_at"]);
const MAX_EXPORT_ROWS = 50000;
const BATCH_SIZE = 1000;
const NO_MATCH_ID = "00000000-0000-0000-0000-000000000000";

const STATUS_LABELS: Record<string, string> = {
  conciliado: "Conciliado",
  no_conciliado: "No conciliado",
};

function str(searchParams: URLSearchParams, key: string) {
  return searchParams.get(key) ?? undefined;
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !can(user.permissions, "recoleccion.export")) {
    return new Response("No autorizado", { status: 403 });
  }

  const { searchParams } = new URL(request.url);

  const rawSort = str(searchParams, "sort");
  const sort: CollectionsSort = {
    column: (rawSort && SORTABLE_COLUMNS.has(rawSort) ? rawSort : "service_date") as CollectionsSort["column"],
    direction: str(searchParams, "dir") === "asc" ? "asc" : "desc",
  };

  const loadTypesParam = str(searchParams, "loadTypes");
  const filters: CollectionsFilters = {
    search: str(searchParams, "q"),
    dateFrom: str(searchParams, "from"),
    dateTo: str(searchParams, "to"),
    clientId: str(searchParams, "client"),
    cityId: str(searchParams, "city"),
    loadTypeIds: loadTypesParam ? loadTypesParam.split(",").filter(Boolean) : undefined,
    reconciliationStatus: str(searchParams, "status") as CollectionsFilters["reconciliationStatus"],
    opportunityMinDays: str(searchParams, "opportunity") ? Number(str(searchParams, "opportunity")) : undefined,
  };

  const supabase = await createClient();
  const [clients, cities, loadTypes] = await Promise.all([getClients(), getCities(), getLoadTypes()]);

  let opportunityIds: string[] | null = null;
  if (filters.opportunityMinDays) {
    const { data } = await supabase.rpc("collections_opportunity_ids", {
      p_min_days: filters.opportunityMinDays,
    });
    opportunityIds = (data ?? []).length > 0 ? (data as string[]) : [NO_MATCH_ID];
  }

  const rows: CollectionRow[] = [];
  let from = 0;
  let truncated = false;

  while (from < MAX_EXPORT_ROWS) {
    let query = supabase.from("collections").select(SELECT_COLUMNS).is("deleted_at", null);

    if (filters.clientId) query = query.eq("client_id", filters.clientId);
    if (filters.cityId) query = query.eq("city_id", filters.cityId);
    if (filters.loadTypeIds?.length) query = query.in("load_type_id", filters.loadTypeIds);
    if (filters.reconciliationStatus) query = query.eq("reconciliation_status", filters.reconciliationStatus);
    if (filters.dateFrom) query = query.gte("service_date", filters.dateFrom);
    if (filters.dateTo) query = query.lte("service_date", filters.dateTo);
    if (opportunityIds) query = query.in("id", opportunityIds);
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

    rows.push(...((data ?? []) as unknown as CollectionRow[]));

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
    { header: "Ciudad", key: "city", width: 14 },
    { header: "Código CEDI", key: "cedi_code", width: 12 },
    { header: "Nombre CEDI", key: "cedi_name", width: 28 },
    { header: "Dirección", key: "service_address", width: 26 },
    { header: "Fecha del servicio", key: "service_date", width: 16 },
    { header: "Tipo de carga", key: "load_type", width: 14 },
    { header: "Conductor", key: "driver_name", width: 22 },
    { header: "Documento del cliente", key: "client_document", width: 18 },
    { header: "Novedad", key: "note", width: 22 },
    { header: "Recaudo", key: "collection_amount", width: 14 },
    { header: "Estado de conciliación", key: "status", width: 18 },
    { header: "Registrado por", key: "created_by", width: 22 },
    { header: "Fecha de registro", key: "created_at", width: 18 },
    { header: "Visitas", key: "visits", width: 10 },
    { header: "Oportunidad (días)", key: "opportunity_days", width: 16 },
  ];
  dataSheet.getRow(1).font = { bold: true };
  dataSheet.autoFilter = { from: "A1", to: "R1" };

  let totalAmount = 0;
  for (const row of rows) {
    totalAmount += row.collection_amount ?? 0;
    dataSheet.addRow({
      service_number: row.service_number,
      client_name: row.client_name ?? "",
      client: row.client?.name ?? "",
      city: row.city?.name ?? "",
      cedi_code: row.cedi_code ?? "",
      cedi_name: row.cedi_name ?? "",
      service_address: row.service_address ?? "",
      service_date: formatDate(row.service_date),
      load_type: row.load_type?.name ?? "",
      driver_name: row.driver_name ?? "",
      client_document: row.client_document ?? "",
      note: row.note ?? "",
      collection_amount: row.collection_amount ?? 0,
      status: STATUS_LABELS[row.reconciliation_status] ?? row.reconciliation_status,
      created_by: row.created_by_profile?.full_name ?? "",
      created_at: formatDateTime(row.created_at),
      visits: row.visits ?? 1,
      opportunity_days: computeOpportunityDays(row),
    });
  }
  dataSheet.getColumn("collection_amount").numFmt = "#,##0";

  const summarySheet = workbook.addWorksheet("Resumen");
  summarySheet.getColumn(1).width = 26;
  summarySheet.getColumn(2).width = 46;

  const clientName = clients.find((c) => c.id === filters.clientId)?.name ?? "Todos";
  const cityName = cities.find((c) => c.id === filters.cityId)?.name ?? "Todas";
  const loadTypeNames = filters.loadTypeIds?.length
    ? loadTypes.filter((l) => filters.loadTypeIds?.includes(l.id)).map((l) => l.name).join(", ")
    : "Todos";
  const statusLabel = filters.reconciliationStatus ? STATUS_LABELS[filters.reconciliationStatus] : "Todos";

  const summaryRows: [string, string | number][] = [
    ["Reporte", "Recolección"],
    ["Generado por", user.fullName],
    ["Fecha de descarga", formatDateTime(new Date().toISOString())],
    ["Total de registros", rows.length],
    ["Recaudo total", totalAmount],
    ["", ""],
    ["Filtros aplicados", ""],
    ["Buscar", filters.search || "(ninguno)"],
    ["Desde", filters.dateFrom ? formatDate(filters.dateFrom) : "(sin límite)"],
    ["Hasta", filters.dateTo ? formatDate(filters.dateTo) : "(sin límite)"],
    ["Cliente", clientName],
    ["Ciudad", cityName],
    ["Tipo de carga", loadTypeNames],
    ["Estado de conciliación", statusLabel],
    ["Oportunidad", filters.opportunityMinDays ? `${filters.opportunityMinDays}+ días sin conciliar` : "Todas"],
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
  const fileName = `recoleccion_${getTodayBogota()}.xlsx`;

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
