import ExcelJS from "exceljs";
import { getCurrentUser, can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { getClients, getServiceTypes, getVisibleCities } from "@/lib/catalog/queries";
import { formatDate, formatDateTime, getTodayBogota } from "@/lib/format";
import { STATUS_OPTIONS } from "@/lib/availabilities/types";
import type { AvailabilityRow, AvailabilityFilters, AvailabilitySort } from "@/lib/availabilities/types";

const SELECT_COLUMNS = `
  id, client_id, service_type_id, city_id, quicker_name, cedula, date, payment, concept,
  order_number, observation, status, created_at,
  client:clients(name),
  service_type:service_types(name),
  city:cities(name),
  created_by_profile:profiles!availabilities_created_by_fkey(full_name)
`;

const SORTABLE_COLUMNS = new Set(["date", "payment", "created_at"]);
const MAX_EXPORT_ROWS = 50000;
const BATCH_SIZE = 1000;

const STATUS_LABELS: Record<string, string> = Object.fromEntries(STATUS_OPTIONS.map((s) => [s.value, s.label]));

function str(searchParams: URLSearchParams, key: string) {
  return searchParams.get(key) ?? undefined;
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !can(user.permissions, "disponibilidades.export")) {
    return new Response("No autorizado", { status: 403 });
  }

  const { searchParams } = new URL(request.url);

  const rawSort = str(searchParams, "sort");
  const sort: AvailabilitySort = {
    column: (rawSort && SORTABLE_COLUMNS.has(rawSort) ? rawSort : "date") as AvailabilitySort["column"],
    direction: str(searchParams, "dir") === "asc" ? "asc" : "desc",
  };

  const filters: AvailabilityFilters = {
    search: str(searchParams, "q"),
    dateFrom: str(searchParams, "from"),
    dateTo: str(searchParams, "to"),
    clientId: str(searchParams, "client"),
    serviceTypeId: str(searchParams, "serviceType"),
    cityId: str(searchParams, "city"),
    status: str(searchParams, "status") as AvailabilityFilters["status"],
  };

  const supabase = await createClient();
  const [clients, serviceTypes, cities] = await Promise.all([
    getClients(),
    getServiceTypes("disponibilidades"),
    getVisibleCities(),
  ]);

  const rows: AvailabilityRow[] = [];
  let from = 0;
  let truncated = false;

  while (from < MAX_EXPORT_ROWS) {
    let query = supabase.from("availabilities").select(SELECT_COLUMNS).is("deleted_at", null);

    if (filters.clientId) query = query.eq("client_id", filters.clientId);
    if (filters.serviceTypeId) query = query.eq("service_type_id", filters.serviceTypeId);
    if (filters.cityId) query = query.eq("city_id", filters.cityId);
    if (filters.status) query = query.eq("status", filters.status);
    if (filters.dateFrom) query = query.gte("date", filters.dateFrom);
    if (filters.dateTo) query = query.lte("date", filters.dateTo);
    if (filters.search?.trim()) {
      const term = filters.search.trim();
      query = query.or(`quicker_name.ilike.%${term}%,cedula.ilike.%${term}%,order_number.ilike.%${term}%`);
    }

    const to = Math.min(from + BATCH_SIZE, MAX_EXPORT_ROWS) - 1;
    const { data, error } = await query
      .order(sort.column, { ascending: sort.direction === "asc" })
      .range(from, to);

    if (error) {
      return new Response(`Error generando el archivo: ${error.message}`, { status: 500 });
    }

    rows.push(...((data ?? []) as unknown as AvailabilityRow[]));

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
    { header: "N° orden", key: "order_number", width: 18 },
    { header: "Cliente", key: "client", width: 18 },
    { header: "Coordinador", key: "coordinator", width: 22 },
    { header: "Ciudad", key: "city", width: 16 },
    { header: "Tipo de servicio", key: "service_type", width: 16 },
    { header: "Quicker", key: "quicker_name", width: 22 },
    { header: "Cédula", key: "cedula", width: 14 },
    { header: "Fecha", key: "date", width: 14 },
    { header: "Pago", key: "payment", width: 14 },
    { header: "Concepto", key: "concept", width: 22 },
    { header: "Observaciones", key: "observation", width: 26 },
    { header: "Estado", key: "status", width: 14 },
    { header: "Fecha de registro", key: "created_at", width: 18 },
  ];
  dataSheet.getRow(1).font = { bold: true };
  dataSheet.autoFilter = { from: "A1", to: "M1" };

  let totalPayment = 0;
  for (const row of rows) {
    totalPayment += row.payment ?? 0;
    dataSheet.addRow({
      order_number: row.order_number,
      client: row.client?.name ?? "",
      coordinator: row.created_by_profile?.full_name ?? "",
      city: row.city?.name ?? "",
      service_type: row.service_type?.name ?? "",
      quicker_name: row.quicker_name,
      cedula: row.cedula,
      date: formatDate(row.date),
      payment: row.payment ?? 0,
      concept: row.concept ?? "",
      observation: row.observation ?? "",
      status: STATUS_LABELS[row.status] ?? row.status,
      created_at: formatDateTime(row.created_at),
    });
  }
  dataSheet.getColumn("payment").numFmt = "#,##0";

  const summarySheet = workbook.addWorksheet("Resumen");
  summarySheet.getColumn(1).width = 26;
  summarySheet.getColumn(2).width = 46;

  const clientName = clients.find((c) => c.id === filters.clientId)?.name ?? "Todos";
  const serviceTypeName = serviceTypes.find((s) => s.id === filters.serviceTypeId)?.name ?? "Todos";
  const cityName = cities.find((c) => c.id === filters.cityId)?.name ?? "Todas";
  const statusLabel = filters.status ? STATUS_LABELS[filters.status] : "Todos";

  const summaryRows: [string, string | number][] = [
    ["Reporte", "Disponibilidades"],
    ["Generado por", user.fullName],
    ["Fecha de descarga", formatDateTime(new Date().toISOString())],
    ["Total de registros", rows.length],
    ["Pago total", totalPayment],
    ["", ""],
    ["Filtros aplicados", ""],
    ["Buscar (Quicker/cédula/orden)", filters.search || "(ninguno)"],
    ["Desde", filters.dateFrom ? formatDate(filters.dateFrom) : "(sin límite)"],
    ["Hasta", filters.dateTo ? formatDate(filters.dateTo) : "(sin límite)"],
    ["Cliente", clientName],
    ["Tipo de servicio", serviceTypeName],
    ["Ciudad", cityName],
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
  const fileName = `disponibilidades_${getTodayBogota()}.xlsx`;

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
