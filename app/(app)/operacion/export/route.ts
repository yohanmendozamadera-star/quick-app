import ExcelJS from "exceljs";
import { getCurrentUser, can } from "@/lib/permissions";
import { getOperacionResumen } from "@/lib/operacion/queries";
import { getClients, getVisibleCities } from "@/lib/catalog/queries";
import { formatDate, formatDateTime, getTodayBogota } from "@/lib/format";

function str(searchParams: URLSearchParams, key: string) {
  return searchParams.get(key) ?? undefined;
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !can(user.permissions, "dashboard.view")) {
    return new Response("No autorizado", { status: 403 });
  }

  const { searchParams } = new URL(request.url);

  const dateFrom = str(searchParams, "from") || getTodayBogota();
  const dateTo = str(searchParams, "to") || getTodayBogota();
  const clientId = str(searchParams, "client");

  const [{ rows, error }, clients, cities] = await Promise.all([
    getOperacionResumen({ dateFrom, dateTo, clientId }),
    getClients(),
    getVisibleCities(),
  ]);

  if (error) {
    return new Response(`Error generando el archivo: ${error.message}`, { status: 500 });
  }

  const cityName = (id: string) => cities.find((c) => c.id === id)?.name ?? "Sin ciudad";
  const sortedRows = [...rows].sort((a, b) => cityName(a.cityId).localeCompare(cityName(b.cityId)));

  const totals = rows.reduce(
    (acc, row) => {
      acc.recoleccion += row.recoleccion;
      acc.noConciliados += row.noConciliados;
      acc.tipoServicio += row.tipoServicio;
      acc.disponibilidad += row.disponibilidad;
      acc.adicionales += row.adicionales;
      return acc;
    },
    { recoleccion: 0, noConciliados: 0, tipoServicio: 0, disponibilidad: 0, adicionales: 0 },
  );

  const workbook = new ExcelJS.Workbook();

  const dataSheet = workbook.addWorksheet("Operación");
  dataSheet.columns = [
    { header: "Ciudad", key: "city", width: 20 },
    { header: "Recolección", key: "recoleccion", width: 16 },
    { header: "No conciliados", key: "noConciliados", width: 16 },
    { header: "Tipo Servicio", key: "tipoServicio", width: 16 },
    { header: "Disponibilidad", key: "disponibilidad", width: 16 },
    { header: "Adicionales", key: "adicionales", width: 16 },
  ];
  dataSheet.getRow(1).font = { bold: true };
  dataSheet.autoFilter = { from: "A1", to: "F1" };

  const totalRow = dataSheet.addRow({
    city: "Consolidado",
    recoleccion: totals.recoleccion,
    noConciliados: totals.noConciliados,
    tipoServicio: totals.tipoServicio,
    disponibilidad: totals.disponibilidad,
    adicionales: totals.adicionales,
  });
  totalRow.font = { bold: true };

  for (const row of sortedRows) {
    dataSheet.addRow({
      city: cityName(row.cityId),
      recoleccion: row.recoleccion,
      noConciliados: row.noConciliados,
      tipoServicio: row.tipoServicio,
      disponibilidad: row.disponibilidad,
      adicionales: row.adicionales,
    });
  }

  const summarySheet = workbook.addWorksheet("Resumen");
  summarySheet.getColumn(1).width = 26;
  summarySheet.getColumn(2).width = 46;

  const clientName = clients.find((c) => c.id === clientId)?.name ?? "Todas";

  const summaryRows: [string, string | number][] = [
    ["Reporte", "Operación"],
    ["Generado por", user.fullName],
    ["Fecha de descarga", formatDateTime(new Date().toISOString())],
    ["Desde", formatDate(dateFrom)],
    ["Hasta", formatDate(dateTo)],
    ["Operación (cliente)", clientName],
  ];
  summaryRows.forEach((r) => summarySheet.addRow(r));
  summarySheet.getColumn(1).font = { bold: true };

  const buffer = await workbook.xlsx.writeBuffer();
  const fileName = `operacion_${getTodayBogota()}.xlsx`;

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
