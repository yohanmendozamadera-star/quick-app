import ExcelJS from "exceljs";
import { getCurrentUser, can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { getAllClients, getAllCities, getAllCedis } from "@/lib/catalog/queries";
import { formatDate, formatDateTime } from "@/lib/format";
import { computeOpportunityDays } from "@/lib/collections/opportunity";
import type { ReconciliationStatus } from "@/lib/collections/types";

type PendingRow = {
  service_number: string;
  client_document: string | null;
  service_address: string | null;
  collection_amount: number;
  service_date: string;
  created_at: string;
  reconciliation_status: ReconciliationStatus;
  reconciled_at: string | null;
  load_type: { name: string } | null;
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> },
) {
  const user = await getCurrentUser();
  if (!user || !can(user.permissions, "conciliacion.export")) {
    return new Response("No autorizado", { status: 403 });
  }

  const { clientId } = await params;
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  const cityId = searchParams.get("cityId");
  const cediCode = searchParams.get("cediCode");
  const cediName = searchParams.get("cediName") || cediCode;

  if (!clientId || !date || !cityId || !cediCode) {
    return new Response("Parámetros incompletos", { status: 400 });
  }

  const [clients, cities, cedis] = await Promise.all([getAllClients(), getAllCities(), getAllCedis()]);
  const clientName = clients.find((c) => c.id === clientId)?.name ?? "Cliente";
  const cityName = cities.find((c) => c.id === cityId)?.name ?? "Ciudad";
  const resolvedCediName = cedis.find((c) => c.code === cediCode)?.name ?? cediName ?? cediCode;

  const supabase = await createClient();

  const { data: collections } = await supabase
    .from("collections")
    .select(
      "service_number, client_document, service_address, collection_amount, service_date, created_at, reconciliation_status, reconciled_at, load_type:load_types(name)",
    )
    .eq("client_id", clientId)
    .eq("city_id", cityId)
    .eq("cedi_code", cediCode)
    .eq("service_date", date)
    .eq("reconciliation_status", "no_conciliado")
    .is("deleted_at", null)
    .order("service_number");

  const rows = (collections ?? []) as unknown as PendingRow[];
  const totalAmount = rows.reduce((sum, r) => sum + (r.collection_amount ?? 0), 0);

  const workbook = new ExcelJS.Workbook();

  const dataSheet = workbook.addWorksheet("Pendientes");
  dataSheet.columns = [
    { header: "N° Servicio", key: "service_number", width: 16 },
    { header: "Documento cliente", key: "client_document", width: 18 },
    { header: "Dirección", key: "service_address", width: 30 },
    { header: "Fecha servicio", key: "service_date", width: 16 },
    { header: "Tipo de carga", key: "load_type", width: 16 },
    { header: "Recaudo", key: "collection_amount", width: 14 },
    { header: "Días sin conciliar", key: "opportunity_days", width: 16 },
  ];
  dataSheet.getRow(1).font = { bold: true };
  dataSheet.autoFilter = { from: "A1", to: "G1" };

  for (const row of rows) {
    dataSheet.addRow({
      service_number: row.service_number,
      client_document: row.client_document ?? "",
      service_address: row.service_address ?? "",
      service_date: formatDate(row.service_date),
      load_type: row.load_type?.name ?? "",
      collection_amount: row.collection_amount ?? 0,
      opportunity_days: computeOpportunityDays(row),
    });
  }
  dataSheet.getColumn("collection_amount").numFmt = "#,##0";

  const summarySheet = workbook.addWorksheet("Resumen");
  summarySheet.getColumn(1).width = 26;
  summarySheet.getColumn(2).width = 46;

  const summaryRows: [string, string | number][] = [
    ["Reporte", "Pendientes de conciliar"],
    ["Generado por", user.fullName],
    ["Fecha de descarga", formatDateTime(new Date().toISOString())],
    ["Cliente", clientName],
    ["Ciudad", cityName],
    ["CEDI", `${resolvedCediName} (${cediCode})`],
    ["Fecha", formatDate(date)],
    ["Total pendientes", rows.length],
    ["Valor total", totalAmount],
  ];
  summaryRows.forEach((r) => summarySheet.addRow(r));
  summarySheet.getColumn(1).font = { bold: true };

  const buffer = await workbook.xlsx.writeBuffer();
  const fileName = `pendientes_${cediCode}_${date}.xlsx`;

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
