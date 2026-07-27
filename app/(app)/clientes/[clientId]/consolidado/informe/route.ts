import PDFDocument from "pdfkit";
import { getCurrentUser, can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { getAllClients, getAllCities } from "@/lib/catalog/queries";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";

type CollectionRow = {
  service_number: string;
  client_document: string | null;
  collection_amount: number;
  service_date: string;
  reconciliation_status: string;
};

const COLORS = {
  header: "#1e293b",
  headerText: "#f8fafc",
  text: "#111827",
  muted: "#6b7280",
  border: "#e5e7eb",
  rowAlt: "#f8fafc",
  recolectado: "#1d4ed8",
  conciliado: "#059669",
  pendiente: "#d97706",
};

const PAGE_WIDTH = 612;
const MARGIN = 40;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

function drawHeader(doc: PDFKit.PDFDocument, title: string, subtitle: string) {
  doc.rect(0, 0, PAGE_WIDTH, 84).fill(COLORS.header);
  doc.fillColor(COLORS.headerText).font("Helvetica-Bold").fontSize(18).text(title, MARGIN, 26);
  doc.font("Helvetica").fontSize(10).text(subtitle, MARGIN, 52);
  doc.fillColor(COLORS.text);
  doc.x = MARGIN;
  doc.y = 104;
}

function drawInfoBox(doc: PDFKit.PDFDocument, rows: [string, string][]) {
  const boxY = doc.y;
  const rowHeight = 18;
  const boxHeight = rows.length * rowHeight + 16;
  doc.roundedRect(MARGIN, boxY, CONTENT_WIDTH, boxHeight, 4).stroke(COLORS.border);

  let y = boxY + 10;
  for (const [label, value] of rows) {
    doc.font("Helvetica-Bold").fontSize(9).fillColor(COLORS.muted).text(label, MARGIN + 12, y, { width: 120 });
    doc.font("Helvetica").fontSize(10).fillColor(COLORS.text).text(value, MARGIN + 140, y, {
      width: CONTENT_WIDTH - 152,
    });
    y += rowHeight;
  }

  doc.y = boxY + boxHeight + 16;
  doc.x = MARGIN;
}

function drawStatCards(doc: PDFKit.PDFDocument, cards: { label: string; count: number; amount: number; color: string }[]) {
  const gap = 12;
  const cardWidth = (CONTENT_WIDTH - gap * (cards.length - 1)) / cards.length;
  const cardHeight = 58;
  const y = doc.y;

  cards.forEach((card, i) => {
    const x = MARGIN + i * (cardWidth + gap);
    doc.roundedRect(x, y, cardWidth, cardHeight, 4).fill("#f8fafc");
    doc.rect(x, y, 4, cardHeight).fill(card.color);
    doc.font("Helvetica-Bold").fontSize(9).fillColor(COLORS.muted).text(card.label, x + 14, y + 10, {
      width: cardWidth - 24,
    });
    doc
      .font("Helvetica-Bold")
      .fontSize(16)
      .fillColor(COLORS.text)
      .text(card.count.toLocaleString("es-CO"), x + 14, y + 24, { width: cardWidth - 24 });
    doc.font("Helvetica").fontSize(9).fillColor(COLORS.muted).text(formatCurrency(card.amount), x + 14, y + 42, {
      width: cardWidth - 24,
    });
  });

  doc.y = y + cardHeight + 20;
  doc.x = MARGIN;
}

function drawTable(
  doc: PDFKit.PDFDocument,
  title: string,
  count: number,
  amount: number,
  color: string,
  headers: string[],
  rows: (string | number)[][],
  columnWidths: number[],
) {
  doc
    .font("Helvetica-Bold")
    .fontSize(11)
    .fillColor(COLORS.text)
    .text(`${title} (${count}) — ${formatCurrency(amount)}`, MARGIN, doc.y);
  doc.moveDown(0.4);

  if (rows.length === 0) {
    doc.font("Helvetica").fontSize(9).fillColor(COLORS.muted).text("Sin registros.", MARGIN, doc.y);
    doc.moveDown(1.2);
    doc.fillColor(COLORS.text);
    return;
  }

  const startX = MARGIN;
  let y = doc.y;

  doc.rect(startX, y, CONTENT_WIDTH, 18).fill(color);
  doc.font("Helvetica-Bold").fontSize(8).fillColor("#ffffff");
  headers.forEach((header, i) => {
    const x = startX + columnWidths.slice(0, i).reduce((a, b) => a + b, 0);
    doc.text(header, x + 6, y + 5, { width: columnWidths[i] - 6 });
  });
  y += 18;

  doc.font("Helvetica").fontSize(8.5).fillColor(COLORS.text);
  rows.forEach((row, rowIndex) => {
    if (y > 730) {
      doc.addPage();
      y = MARGIN;
    }
    if (rowIndex % 2 === 1) {
      doc.rect(startX, y, CONTENT_WIDTH, 16).fill(COLORS.rowAlt);
      doc.fillColor(COLORS.text);
    }
    row.forEach((cell, i) => {
      const x = startX + columnWidths.slice(0, i).reduce((a, b) => a + b, 0);
      doc.text(String(cell), x + 6, y + 4, { width: columnWidths[i] - 6 });
    });
    y += 16;
  });

  doc.moveTo(startX, y).lineTo(startX + CONTENT_WIDTH, y).stroke(COLORS.border);
  doc.y = y + 20;
  doc.x = MARGIN;
  doc.fillColor(COLORS.text);
}

function drawSignature(doc: PDFKit.PDFDocument) {
  if (doc.y > 680) doc.addPage();
  const y = doc.y + 20;

  doc.moveTo(MARGIN, y).lineTo(MARGIN + 240, y).stroke(COLORS.border);
  doc.font("Helvetica-Bold").fontSize(9).fillColor(COLORS.text).text("Firma", MARGIN, y + 6);

  doc.moveTo(MARGIN + 280, y).lineTo(MARGIN + CONTENT_WIDTH, y).stroke(COLORS.border);
  doc.font("Helvetica-Bold").fontSize(9).fillColor(COLORS.text).text("Fecha", MARGIN + 280, y + 6);

  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor(COLORS.muted)
    .text("Coordinador de Operación", MARGIN, y + 22);
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
  const cediName = searchParams.get("cediName") || cediCode;

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
  const conciliados = rows.filter((r) => r.reconciliation_status === "conciliado");
  const pendientes = rows.filter((r) => r.reconciliation_status === "no_conciliado");

  const sum = (list: { collection_amount: number }[]) =>
    list.reduce((acc, r) => acc + (r.collection_amount ?? 0), 0);

  const doc = new PDFDocument({ margin: MARGIN, size: "letter", bufferPages: true });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk) => chunks.push(chunk));
  const donePromise = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  drawHeader(doc, "Informe de Conciliación", `Generado el ${formatDateTime(new Date().toISOString())}`);

  drawInfoBox(doc, [
    ["Cliente", clientName],
    ["Ciudad", cityName],
    ["CEDI", `${cediName} (${cediCode})`],
    ["Fecha", formatDate(date)],
  ]);

  drawStatCards(doc, [
    { label: "TOTAL RECOLECTADO", count: rows.length, amount: sum(rows), color: COLORS.recolectado },
    { label: "TOTAL CONCILIADO", count: conciliados.length, amount: sum(conciliados), color: COLORS.conciliado },
    { label: "TOTAL PENDIENTE", count: pendientes.length, amount: sum(pendientes), color: COLORS.pendiente },
  ]);

  const detailColumns = [150, 150, 132, 100];
  drawTable(
    doc,
    "Detalle conciliado",
    conciliados.length,
    sum(conciliados),
    COLORS.conciliado,
    ["N° servicio", "Documento", "Fecha servicio", "Valor"],
    conciliados.map((r) => [r.service_number, r.client_document ?? "—", formatDate(r.service_date), formatCurrency(r.collection_amount)]),
    detailColumns,
  );

  drawTable(
    doc,
    "Detalle pendiente",
    pendientes.length,
    sum(pendientes),
    COLORS.pendiente,
    ["N° servicio", "Documento", "Fecha servicio", "Valor"],
    pendientes.map((r) => [r.service_number, r.client_document ?? "—", formatDate(r.service_date), formatCurrency(r.collection_amount)]),
    detailColumns,
  );

  drawSignature(doc);

  doc.end();
  const buffer = await donePromise;

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="consolidado_${cediCode}_${date}.pdf"`,
    },
  });
}
