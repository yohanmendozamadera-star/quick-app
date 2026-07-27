import PDFDocument from "pdfkit";
import { getCurrentUser, can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { getAllClients, getAllCities } from "@/lib/catalog/queries";
import { formatCurrency, formatDate } from "@/lib/format";

type CollectionRow = {
  service_number: string;
  client_document: string | null;
  collection_amount: number;
  service_date: string;
};

function monthEndIso(period: string) {
  const date = new Date(`${period}T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + 1);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
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
  const cityId = searchParams.get("cityId");
  const cediCode = searchParams.get("cediCode");
  const period = searchParams.get("period");

  if (!clientId || !cityId || !cediCode || !period) {
    return new Response("Parámetros incompletos", { status: 400 });
  }

  const [clients, cities] = await Promise.all([getAllClients(), getAllCities()]);
  const clientName = clients.find((c) => c.id === clientId)?.name ?? "Cliente";
  const cityName = cities.find((c) => c.id === cityId)?.name ?? "Ciudad";

  const supabase = await createClient();
  const monthEnd = monthEndIso(period);

  const { data: collections } = await supabase
    .from("collections")
    .select("service_number, client_document, collection_amount, service_date, reconciliation_status")
    .eq("client_id", clientId)
    .eq("city_id", cityId)
    .eq("cedi_code", cediCode)
    .gte("service_date", period)
    .lte("service_date", monthEnd)
    .is("deleted_at", null);

  const rows = (collections ?? []) as (CollectionRow & { reconciliation_status: string })[];
  const pending = rows.filter((r) => r.reconciliation_status === "no_conciliado");
  const pendingAmount = pending.reduce((sum, r) => sum + (r.collection_amount ?? 0), 0);

  const doc = new PDFDocument({ margin: 40, size: "letter" });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk) => chunks.push(chunk));
  const donePromise = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  const periodLabel = new Intl.DateTimeFormat("es-CO", { month: "long", year: "numeric" }).format(
    new Date(`${period}T00:00:00`),
  );

  if (pendingAmount === 0) {
    doc.font("Helvetica-Bold").fontSize(16).text("Acta de Paz y Salvo", { align: "center" });
    doc.moveDown(0.5);
    doc.font("Helvetica").fontSize(10);
    doc.text(`Cliente: ${clientName}`);
    doc.text(`Ciudad: ${cityName}`);
    doc.text(`CEDI: ${cediCode}`);
    doc.text(`Periodo: ${periodLabel}`);
    doc.moveDown(1);
    doc.fontSize(11).text(
      `Se hace constar que el CEDI ${cediCode} (${cityName}) se encuentra a PAZ Y SALVO por el periodo de ${periodLabel}, ` +
        `al no tener recolecciones pendientes de conciliar dentro de dicho periodo.`,
      { align: "justify" },
    );
    doc.moveDown(2);
    doc.text("_____________________________");
    doc.text("Firma autorizada");
  } else {
    doc.font("Helvetica-Bold").fontSize(16).text("Compromiso de Pago", { align: "center" });
    doc.moveDown(0.5);
    doc.font("Helvetica").fontSize(10);
    doc.text(`Cliente: ${clientName}`);
    doc.text(`Ciudad: ${cityName}`);
    doc.text(`CEDI: ${cediCode}`);
    doc.text(`Periodo: ${periodLabel}`);
    doc.moveDown(1);
    doc
      .fontSize(11)
      .text(
        `El CEDI ${cediCode} (${cityName}) presenta recolecciones pendientes de conciliar por el periodo de ${periodLabel}, ` +
          `por un valor total de ${formatCurrency(pendingAmount)}. Se deja constancia del compromiso de gestionar ` +
          `el cierre de estos registros a la brevedad.`,
        { align: "justify" },
      );
    doc.moveDown(1);
    doc.font("Helvetica-Bold").fontSize(12).text(`Pendientes (${pending.length}) — ${formatCurrency(pendingAmount)}`);
    doc.moveDown(0.3);
    drawTable(
      doc,
      ["N° servicio", "Documento", "Fecha servicio", "Valor"],
      pending.map((r) => [
        r.service_number,
        r.client_document ?? "—",
        formatDate(r.service_date),
        formatCurrency(r.collection_amount),
      ]),
      [140, 140, 140, 100],
    );
    doc.moveDown(2);
    doc.text("_____________________________");
    doc.text("Firma autorizada");
  }

  doc.end();
  const buffer = await donePromise;

  const documentType = pendingAmount === 0 ? "paz_y_salvo" : "compromiso";
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="${documentType}_${cediCode}_${period}.pdf"`,
    },
  });
}
