import PDFDocument from "pdfkit";
import { getCurrentUser, can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { getAllClients, getAllCities } from "@/lib/catalog/queries";
import { formatCurrency, formatDate, getTodayBogota } from "@/lib/format";

type CollectionRow = {
  service_number: string;
  client_document: string | null;
  collection_amount: number;
  service_date: string;
  reconciliation_status: string;
};

function daysBetweenIso(fromIso: string, toIso: string) {
  const from = new Date(`${fromIso}T00:00:00Z`).getTime();
  const to = new Date(`${toIso}T00:00:00Z`).getTime();
  return Math.round((to - from) / (1000 * 60 * 60 * 24));
}

function drawTable(
  doc: PDFKit.PDFDocument,
  headers: string[],
  rows: (string | number)[][],
  columnWidths: number[],
) {
  const startX = doc.x;
  let y = doc.y;

  doc.font("Helvetica-Bold").fontSize(9);
  headers.forEach((header, i) => {
    const x = startX + columnWidths.slice(0, i).reduce((a, b) => a + b, 0);
    doc.text(header, x, y, { width: columnWidths[i] });
  });
  y += 16;

  doc.font("Helvetica").fontSize(9);
  for (const row of rows) {
    if (y > 740) {
      doc.addPage();
      y = doc.y;
    }
    row.forEach((cell, i) => {
      const x = startX + columnWidths.slice(0, i).reduce((a, b) => a + b, 0);
      doc.text(String(cell), x, y, { width: columnWidths[i] });
    });
    y += 14;
  }

  doc.y = y + 10;
}

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

  if (!clientId || !date || !cityId || !cediCode) {
    return new Response("Parámetros incompletos", { status: 400 });
  }

  const [clients, cities] = await Promise.all([getAllClients(), getAllCities()]);
  const clientName = clients.find((c) => c.id === clientId)?.name ?? "Cliente";
  const cityName = cities.find((c) => c.id === cityId)?.name ?? "Ciudad";

  const supabase = await createClient();

  const { data: collections } = await supabase
    .from("collections")
    .select("service_number, client_document, collection_amount, service_date, reconciliation_status")
    .eq("client_id", clientId)
    .eq("city_id", cityId)
    .eq("cedi_code", cediCode)
    .eq("service_date", date)
    .is("deleted_at", null);

  const rows = (collections ?? []) as CollectionRow[];
  const today = getTodayBogota();

  const conciliados = rows.filter((r) => r.reconciliation_status === "conciliado");
  const pendientesTodos = rows.filter((r) => r.reconciliation_status === "no_conciliado");
  const reprogramados = pendientesTodos.filter((r) => daysBetweenIso(r.service_date, today) >= 2);
  const pendientesRecientes = pendientesTodos.filter((r) => daysBetweenIso(r.service_date, today) < 2);

  const sum = (list: { collection_amount: number }[]) =>
    list.reduce((acc, r) => acc + (r.collection_amount ?? 0), 0);

  const doc = new PDFDocument({ margin: 40, size: "letter" });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk) => chunks.push(chunk));
  const donePromise = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  doc.font("Helvetica-Bold").fontSize(16).text("Informe de Conciliación", { align: "center" });
  doc.moveDown(0.5);
  doc.font("Helvetica").fontSize(10);
  doc.text(`Cliente: ${clientName}`);
  doc.text(`Ciudad: ${cityName}`);
  doc.text(`CEDI: ${cediCode}`);
  doc.text(`Fecha: ${formatDate(date)}`);
  doc.moveDown(0.3);
  doc
    .font("Helvetica-Bold")
    .text(`Total recolectado: ${rows.length} — ${formatCurrency(sum(rows))}`);
  doc.moveDown(1);

  const section = (title: string, list: CollectionRow[]) => {
    doc.font("Helvetica-Bold").fontSize(12).text(`${title} (${list.length}) — ${formatCurrency(sum(list))}`);
    doc.moveDown(0.3);
    if (list.length > 0) {
      drawTable(
        doc,
        ["N° servicio", "Documento", "Fecha servicio", "Valor"],
        list.map((r) => [
          r.service_number,
          r.client_document ?? "—",
          formatDate(r.service_date),
          formatCurrency(r.collection_amount),
        ]),
        [140, 140, 140, 100],
      );
    } else {
      doc.font("Helvetica").fontSize(9).text("Sin registros.");
      doc.moveDown(1);
    }
  };

  section("Conciliado", conciliados);
  section("Reprogramados", reprogramados);
  section("Pendientes (recientes)", pendientesRecientes);

  doc.end();
  const buffer = await donePromise;

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="consolidado_${cediCode}_${date}.pdf"`,
    },
  });
}
