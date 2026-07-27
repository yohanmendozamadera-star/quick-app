import ExcelJS from "exceljs";
import { getCurrentUser, can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import {
  getCoordinators,
  getCenlogs,
  getServiceTypes,
  getChargeDescriptions,
} from "@/lib/catalog/queries";
import { formatDate, formatDateTime, formatWorkedHours, getTodayBogota } from "@/lib/format";
import { STATUS_OPTIONS } from "@/lib/additional-services/types";
import type { AdditionalServiceRow, AdditionalServiceFilters, AdditionalServiceSort } from "@/lib/additional-services/types";

const SELECT_COLUMNS = `
  id, coordinator_id, cenlog_id, cedi_id, service_type_id, resources_count_range, resource_group_id,
  resource_name, resource_document, plate, service_date, transport_type_id, charge_description_id,
  start_time, end_time, services_count, delivery_support_note, client_authorization_note,
  status, reverted_reason, created_at,
  coordinator:coordinators(name),
  cenlog:cenlogs(name),
  cedi:cedis(code, name, city:cities(name)),
  service_type:service_types(name),
  transport_type:transport_types(name),
  charge_description:charge_descriptions(name),
  created_by_profile:profiles!additional_services_created_by_fkey(full_name)
`;

const SORTABLE_COLUMNS = new Set(["service_date", "services_count", "created_at"]);
const MAX_EXPORT_ROWS = 50000;
const BATCH_SIZE = 1000;

const STATUS_LABELS: Record<string, string> = Object.fromEntries(
  STATUS_OPTIONS.map((s) => [s.value, s.label]),
);

function str(searchParams: URLSearchParams, key: string) {
  return searchParams.get(key) ?? undefined;
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !can(user.permissions, "adicionales.export")) {
    return new Response("No autorizado", { status: 403 });
  }

  const { searchParams } = new URL(request.url);

  const rawSort = str(searchParams, "sort");
  const sort: AdditionalServiceSort = {
    column: (rawSort && SORTABLE_COLUMNS.has(rawSort)
      ? rawSort
      : "service_date") as AdditionalServiceSort["column"],
    direction: str(searchParams, "dir") === "asc" ? "asc" : "desc",
  };

  const filters: AdditionalServiceFilters = {
    search: str(searchParams, "q"),
    dateFrom: str(searchParams, "from"),
    dateTo: str(searchParams, "to"),
    coordinatorId: str(searchParams, "coordinator"),
    cenlogId: str(searchParams, "cenlog"),
    serviceTypeId: str(searchParams, "serviceType"),
    chargeDescriptionId: str(searchParams, "chargeDescription"),
    status: str(searchParams, "status") as AdditionalServiceFilters["status"],
  };

  const supabase = await createClient();
  const [coordinators, cenlogs, serviceTypes, chargeDescriptions] = await Promise.all([
    getCoordinators(),
    getCenlogs(),
    getServiceTypes("adicionales"),
    getChargeDescriptions(),
  ]);

  const rows: AdditionalServiceRow[] = [];
  let from = 0;
  let truncated = false;

  while (from < MAX_EXPORT_ROWS) {
    let query = supabase.from("additional_services").select(SELECT_COLUMNS).is("deleted_at", null);

    if (filters.coordinatorId) query = query.eq("coordinator_id", filters.coordinatorId);
    if (filters.cenlogId) query = query.eq("cenlog_id", filters.cenlogId);
    if (filters.serviceTypeId) query = query.eq("service_type_id", filters.serviceTypeId);
    if (filters.chargeDescriptionId) query = query.eq("charge_description_id", filters.chargeDescriptionId);
    if (filters.status) query = query.eq("status", filters.status);
    if (filters.dateFrom) query = query.gte("service_date", filters.dateFrom);
    if (filters.dateTo) query = query.lte("service_date", filters.dateTo);
    if (filters.search?.trim()) {
      const term = filters.search.trim();
      query = query.or(`resource_name.ilike.%${term}%,resource_document.ilike.%${term}%,plate.ilike.%${term}%`);
    }

    const to = Math.min(from + BATCH_SIZE, MAX_EXPORT_ROWS) - 1;
    const { data, error } = await query
      .order(sort.column, { ascending: sort.direction === "asc" })
      .range(from, to);

    if (error) {
      return new Response(`Error generando el archivo: ${error.message}`, { status: 500 });
    }

    rows.push(...((data ?? []) as unknown as AdditionalServiceRow[]));

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
    { header: "Coordinador", key: "coordinator", width: 20 },
    { header: "CENLOG", key: "cenlog", width: 16 },
    { header: "Código droguería", key: "cedi_code", width: 14 },
    { header: "Droguería", key: "cedi_name", width: 26 },
    { header: "Ciudad droguería", key: "cedi_city", width: 16 },
    { header: "Tipo de servicio", key: "service_type", width: 16 },
    { header: "Cantidad de recursos", key: "resources_count_range", width: 12 },
    { header: "Nombre del recurso", key: "resource_name", width: 22 },
    { header: "Cédula del recurso", key: "resource_document", width: 16 },
    { header: "Placa", key: "plate", width: 10 },
    { header: "Fecha del servicio", key: "service_date", width: 16 },
    { header: "Tipo de transporte", key: "transport_type", width: 14 },
    { header: "Descripción del cobro", key: "charge_description", width: 20 },
    { header: "Horario inicio", key: "start_time", width: 12 },
    { header: "Horario fin", key: "end_time", width: 12 },
    { header: "Horas trabajadas", key: "worked_hours", width: 14 },
    { header: "Cantidad de servicios", key: "services_count", width: 12 },
    { header: "Soporte de entregas", key: "delivery_support_note", width: 24 },
    { header: "Autorización del cliente", key: "client_authorization_note", width: 24 },
    { header: "Estado", key: "status", width: 14 },
    { header: "Motivo reversión", key: "reverted_reason", width: 24 },
    { header: "Registrado por", key: "created_by", width: 22 },
    { header: "Fecha de registro", key: "created_at", width: 18 },
  ];
  dataSheet.getRow(1).font = { bold: true };
  dataSheet.autoFilter = { from: "A1", to: "W1" };

  let totalServices = 0;
  for (const row of rows) {
    totalServices += row.services_count ?? 0;
    dataSheet.addRow({
      coordinator: row.coordinator?.name ?? "",
      cenlog: row.cenlog?.name ?? "",
      cedi_code: row.cedi?.code ?? "",
      cedi_name: row.cedi?.name ?? "",
      cedi_city: row.cedi?.city?.name ?? "",
      service_type: row.service_type?.name ?? "",
      resources_count_range: row.resources_count_range === "1-5" ? "1 a 5" : "6 o más",
      resource_name: row.resource_name ?? "",
      resource_document: row.resource_document ?? "",
      plate: row.plate ?? "",
      service_date: formatDate(row.service_date),
      transport_type: row.transport_type?.name ?? "",
      charge_description: row.charge_description?.name ?? "",
      start_time: row.start_time ?? "",
      end_time: row.end_time ?? "",
      worked_hours: formatWorkedHours(row.start_time, row.end_time),
      services_count: row.services_count ?? 0,
      delivery_support_note: row.delivery_support_note ?? "",
      client_authorization_note: row.client_authorization_note ?? "",
      status: STATUS_LABELS[row.status] ?? row.status,
      reverted_reason: row.reverted_reason ?? "",
      created_by: row.created_by_profile?.full_name ?? "",
      created_at: formatDateTime(row.created_at),
    });
  }

  const summarySheet = workbook.addWorksheet("Resumen");
  summarySheet.getColumn(1).width = 26;
  summarySheet.getColumn(2).width = 46;

  const coordinatorName = coordinators.find((c) => c.id === filters.coordinatorId)?.name ?? "Todos";
  const cenlogName = cenlogs.find((c) => c.id === filters.cenlogId)?.name ?? "Todos";
  const serviceTypeName = serviceTypes.find((s) => s.id === filters.serviceTypeId)?.name ?? "Todos";
  const chargeDescriptionName =
    chargeDescriptions.find((c) => c.id === filters.chargeDescriptionId)?.name ?? "Todas";
  const statusLabel = filters.status ? STATUS_LABELS[filters.status] : "Todos";

  const summaryRows: [string, string | number][] = [
    ["Reporte", "Adicionales"],
    ["Generado por", user.fullName],
    ["Fecha de descarga", formatDateTime(new Date().toISOString())],
    ["Total de registros", rows.length],
    ["Total de servicios", totalServices],
    ["", ""],
    ["Filtros aplicados", ""],
    ["Buscar (recurso)", filters.search || "(ninguno)"],
    ["Desde", filters.dateFrom ? formatDate(filters.dateFrom) : "(sin límite)"],
    ["Hasta", filters.dateTo ? formatDate(filters.dateTo) : "(sin límite)"],
    ["Coordinador", coordinatorName],
    ["CENLOG", cenlogName],
    ["Tipo de servicio", serviceTypeName],
    ["Descripción del cobro", chargeDescriptionName],
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
  const fileName = `adicionales_${getTodayBogota()}.xlsx`;

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
