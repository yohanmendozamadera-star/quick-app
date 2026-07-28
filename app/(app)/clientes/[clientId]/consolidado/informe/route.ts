import PDFDocument from "pdfkit";
import { getCurrentUser, can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { getAllClients, getAllCities, getAllCedis } from "@/lib/catalog/queries";
import { formatCurrency, formatDate } from "@/lib/format";
import { getQuickLogoBuffer } from "@/lib/pdf/logo";

type ReconciliationRow = {
  service_number: string;
  client_document: string | null;
  novedad: string | null;
  collection_amount: number;
  service_date: string;
};

const PAGE_WIDTH = 612;
const MARGIN = 40;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const BLACK = "#000000";

/** El archivo de carga masiva suele traer "Sin novedad" como texto literal en la
 * columna Novedad, no vacío — se trata igual que null (sin novedad real). */
function isSinNovedad(novedad: string | null) {
  const normalized = (novedad ?? "").trim().toLowerCase();
  return normalized === "" || normalized === "sin novedad";
}

type Cell = { text: string; width: number; bold?: boolean; fontSize?: number };

/** Dibuja una fila de celdas con borde completo (estilo tabla de Word), altura fija. */
function drawGridRow(doc: PDFKit.PDFDocument, x: number, y: number, cells: Cell[], rowHeight: number) {
  let cellX = x;
  for (const cell of cells) {
    doc.lineWidth(0.75).rect(cellX, y, cell.width, rowHeight).stroke(BLACK);
    doc
      .font(cell.bold ? "Helvetica-Bold" : "Helvetica")
      .fontSize(cell.fontSize ?? 9)
      .fillColor(BLACK)
      .text(cell.text, cellX + 4, y + rowHeight / 2 - 4.5, { width: cell.width - 8 });
    cellX += cell.width;
  }
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
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  const cityId = searchParams.get("cityId");
  const cediCode = searchParams.get("cediCode");

  if (!clientId || !dateFrom || !dateTo || !cityId || !cediCode) {
    return new Response("Parámetros incompletos", { status: 400 });
  }

  const [clients, cities, cedis] = await Promise.all([getAllClients(), getAllCities(), getAllCedis()]);
  const clientName = clients.find((c) => c.id === clientId)?.name ?? "Cliente";
  const cityName = cities.find((c) => c.id === cityId)?.name ?? "Ciudad";
  // El nombre del CEDI se resuelve siempre desde el catálogo (fuente de verdad),
  // no desde el texto denormalizado en collections/reconciliations, que puede
  // faltar en registros antiguos.
  const cediName = cedis.find((c) => c.code === cediCode)?.name ?? searchParams.get("cediName") ?? cediCode;

  const supabase = await createClient();

  // El informe se genera con el filtro de fecha aplicado en Consolidado, que es
  // la fecha de conciliación (cuándo se cargó/procesó el archivo), no la fecha
  // de servicio — así "filtrar por hoy" trae exactamente lo conciliado hoy.
  const { data: reconciliations } = await supabase
    .from("reconciliations")
    .select("service_number, client_document, novedad, collection_amount, service_date")
    .eq("client_id", clientId)
    .eq("city_id", cityId)
    .eq("cedi_code", cediCode)
    .gte("reconciliation_date", dateFrom)
    .lte("reconciliation_date", dateTo)
    .is("deleted_at", null)
    .order("service_number");

  const rows = (reconciliations ?? []) as ReconciliationRow[];
  const sinNovedad = rows.filter((r) => isSinNovedad(r.novedad));
  const conNovedad = rows.filter((r) => !isSinNovedad(r.novedad));
  const sum = (list: { collection_amount: number }[]) =>
    list.reduce((acc, r) => acc + (r.collection_amount ?? 0), 0);

  const doc = new PDFDocument({ margin: MARGIN, size: "letter", bufferPages: true });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk) => chunks.push(chunk));
  const donePromise = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  // ---------- Título ----------
  doc.image(getQuickLogoBuffer(), PAGE_WIDTH - MARGIN - 34, MARGIN - 6, { width: 34, height: 34 });
  doc.font("Helvetica-Bold").fontSize(15).fillColor(BLACK).text("ACTA DE ENTREGA DE ÓRDENES", MARGIN, MARGIN, {
    width: CONTENT_WIDTH,
    align: "center",
  });
  doc.moveDown(0.8);
  doc.font("Helvetica-Bold").fontSize(11).text("INFORMACIÓN GENERAL", MARGIN, doc.y, {
    width: CONTENT_WIDTH,
    align: "center",
  });
  doc.moveDown(0.5);

  // ---------- Cuadro Ciudad / Nodo / Fecha / Código CEDI ----------
  const infoRowHeight = 22;
  const infoCols = [70, 196, 90, 176];
  let y = doc.y;
  drawGridRow(
    doc,
    MARGIN,
    y,
    [
      { text: "Ciudad", width: infoCols[0], bold: true },
      { text: cityName, width: infoCols[1] },
      { text: "Nodo", width: infoCols[2], bold: true },
      { text: cediName ?? "—", width: infoCols[3] },
    ],
    infoRowHeight,
  );
  y += infoRowHeight;
  drawGridRow(
    doc,
    MARGIN,
    y,
    [
      { text: "Fecha", width: infoCols[0], bold: true },
      {
        text: dateFrom === dateTo ? formatDate(dateFrom) : `${formatDate(dateFrom)} - ${formatDate(dateTo)}`,
        width: infoCols[1],
      },
      { text: "Código CEDI", width: infoCols[2], bold: true },
      { text: cediCode, width: infoCols[3] },
    ],
    infoRowHeight,
  );
  y += infoRowHeight + 16;
  doc.y = y;
  doc.x = MARGIN;

  // ---------- Párrafo de constancia ----------
  doc.font("Helvetica").fontSize(10).fillColor(BLACK).text(
    "Por medio de la presente se deja constancia de la entrega de las siguientes órdenes correspondientes a la operación ",
    MARGIN,
    doc.y,
    { width: CONTENT_WIDTH, continued: true, align: "justify" },
  );
  doc.font("Helvetica-Bold").text(clientName, { continued: true });
  doc.font("Helvetica").text(", las cuales fueron verificadas y entregadas para su respectivo trámite.");
  doc.moveDown(1);

  // ---------- Tabla de órdenes ----------
  const orderCols = [30, 90, 90, 90, 90, 142];
  const headerHeight = 20;
  y = doc.y;
  drawGridRow(
    doc,
    MARGIN,
    y,
    [
      { text: "Item", width: orderCols[0], bold: true, fontSize: 8 },
      { text: "Nro. Servicio", width: orderCols[1], bold: true, fontSize: 8 },
      { text: "Documento", width: orderCols[2], bold: true, fontSize: 8 },
      { text: "Valor Recaudo", width: orderCols[3], bold: true, fontSize: 8 },
      { text: "Fecha Servicio", width: orderCols[4], bold: true, fontSize: 8 },
      { text: "Novedad", width: orderCols[5], bold: true, fontSize: 8 },
    ],
    headerHeight,
  );
  y += headerHeight;

  const rowHeight = 18;
  rows.forEach((r, i) => {
    if (y + rowHeight > 740) {
      doc.addPage();
      y = MARGIN;
    }
    drawGridRow(
      doc,
      MARGIN,
      y,
      [
        { text: String(i + 1), width: orderCols[0], fontSize: 8 },
        { text: r.service_number, width: orderCols[1], fontSize: 8 },
        { text: r.client_document ?? "—", width: orderCols[2], fontSize: 8 },
        { text: formatCurrency(r.collection_amount), width: orderCols[3], fontSize: 8 },
        { text: formatDate(r.service_date), width: orderCols[4], fontSize: 8 },
        { text: r.novedad ?? "Sin novedad", width: orderCols[5], fontSize: 8 },
      ],
      rowHeight,
    );
    y += rowHeight;
  });

  if (rows.length === 0) {
    drawGridRow(doc, MARGIN, y, [{ text: "Sin órdenes registradas.", width: CONTENT_WIDTH, fontSize: 8 }], rowHeight);
    y += rowHeight;
  }

  y += 20;
  doc.y = y;
  doc.x = MARGIN;
  if (doc.y > 700) {
    doc.addPage();
    doc.y = MARGIN;
  }

  // ---------- Resumen ----------
  doc.font("Helvetica-Bold").fontSize(12).fillColor(BLACK).text("RESUMEN", MARGIN, doc.y);
  doc.moveDown(0.4);

  const resumenCols = [280, 100, 152];
  const resumenRowHeight = 22;
  y = doc.y;
  const resumenRows: [string, number, number][] = [
    ["Total de órdenes entregadas", rows.length, sum(rows)],
    ["Sin novedad", sinNovedad.length, sum(sinNovedad)],
    ["Con novedad", conNovedad.length, sum(conNovedad)],
  ];
  drawGridRow(
    doc,
    MARGIN,
    y,
    [
      { text: "Concepto", width: resumenCols[0], bold: true },
      { text: "Cantidad", width: resumenCols[1], bold: true },
      { text: "Valor", width: resumenCols[2], bold: true },
    ],
    resumenRowHeight,
  );
  y += resumenRowHeight;
  for (const [label, count, amount] of resumenRows) {
    drawGridRow(
      doc,
      MARGIN,
      y,
      [
        { text: label, width: resumenCols[0] },
        { text: String(count), width: resumenCols[1] },
        { text: formatCurrency(amount), width: resumenCols[2] },
      ],
      resumenRowHeight,
    );
    y += resumenRowHeight;
  }

  y += 20;
  doc.moveTo(MARGIN, y).lineTo(MARGIN + CONTENT_WIDTH, y).lineWidth(1.5).stroke("#9ca3af");
  y += 24;
  doc.y = y;
  doc.x = MARGIN;

  if (doc.y > 680) {
    doc.addPage();
    doc.y = MARGIN;
  }

  // ---------- Responsable de la operación ----------
  doc.font("Helvetica-Bold").fontSize(11).fillColor(BLACK).text("RESPONSABLE DE LA OPERACIÓN", MARGIN, doc.y);
  doc.moveDown(1);

  const lineWidth = CONTENT_WIDTH - 70;
  for (const label of ["Nombre:", "Cargo:", "Firma:"]) {
    const lineY = doc.y;
    doc.font("Helvetica-Bold").fontSize(10).text(label, MARGIN, lineY);
    doc
      .moveTo(MARGIN + 55, lineY + 11)
      .lineTo(MARGIN + 55 + lineWidth, lineY + 11)
      .lineWidth(0.75)
      .stroke(BLACK);
    doc.y = lineY + 26;
  }

  doc.end();
  const buffer = await donePromise;

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="acta_entrega_${cediCode}_${dateFrom}_${dateTo}.pdf"`,
    },
  });
}
