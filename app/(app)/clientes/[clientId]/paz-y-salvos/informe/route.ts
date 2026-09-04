import PDFDocument from "pdfkit";
import { getCurrentUser, can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { getAllClients, getAllCities } from "@/lib/catalog/queries";
import { getTodayBogota, formatDate } from "@/lib/format";
import { getSignatureBuffer, getColsubsidioLogoBuffer } from "@/lib/pdf/logo";
import { drawGridRow } from "@/lib/pdf/grid";

const PAGE_WIDTH = 612;
const MARGIN = 45;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const BLACK = "#000000";

function monthEndIso(period: string) {
  const date = new Date(`${period}T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + 1);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

/** "31 de agosto de 2026" — el formato de corte que pidió el usuario, siempre con día + mes + año completos. */
function formatCorte(isoDate: string) {
  const date = new Date(`${isoDate}T00:00:00`);
  const day = date.getDate();
  const month = new Intl.DateTimeFormat("es-CO", { month: "long" }).format(date);
  const year = date.getFullYear();
  return `${day} de ${month} de ${year}`;
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
  const cediName = searchParams.get("cediName");
  const period = searchParams.get("period");

  if (!clientId || !cityId || !cediName || !period) {
    return new Response("Parámetros incompletos", { status: 400 });
  }

  const [clients, cities] = await Promise.all([getAllClients(), getAllCities()]);
  const clientName = clients.find((c) => c.id === clientId)?.name ?? "Cliente";
  const cityName = cities.find((c) => c.id === cityId)?.name ?? "Ciudad";
  const isColsubsidio = clientName.trim().toLowerCase().includes("colsubsidio");

  const supabase = await createClient();
  const monthStart = period;
  const monthEnd = monthEndIso(period);

  const { count: pendingCount } = await supabase
    .from("collections")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId)
    .eq("city_id", cityId)
    .eq("cedi_name", cediName)
    .eq("reconciliation_status", "no_conciliado")
    .gte("service_date", monthStart)
    .lte("service_date", monthEnd)
    .is("deleted_at", null);

  if ((pendingCount ?? 0) > 0) {
    return new Response(
      "Este CEDI todavía tiene órdenes pendientes de conciliar en este mes — no se puede generar el Paz y Salvo hasta que quede en 0.",
      { status: 409 },
    );
  }

  const monthName = new Intl.DateTimeFormat("es-CO", { month: "long" }).format(new Date(`${monthStart}T00:00:00`));
  const corteLabel = formatCorte(monthEnd);
  const today = getTodayBogota();

  const doc = new PDFDocument({ margin: MARGIN, size: "letter" });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk) => chunks.push(chunk));
  const donePromise = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  // ---------- Encabezado ----------
  let y = MARGIN;
  if (isColsubsidio) {
    doc.image(getColsubsidioLogoBuffer(), MARGIN, y, { width: 90 });
  } else {
    doc.font("Helvetica-Bold").fontSize(12).fillColor(BLACK).text(clientName.toUpperCase(), MARGIN, y);
  }
  y += 34;

  doc.font("Helvetica-Bold").fontSize(13).fillColor(BLACK).text("ACTA DE REUNIÓN VISITA OPL A NODO", MARGIN, y, {
    width: CONTENT_WIDTH,
    align: "center",
  });
  doc.moveDown(0.3);
  doc.font("Helvetica-Bold").fontSize(10).text(clientName.toUpperCase(), MARGIN, doc.y, {
    width: CONTENT_WIDTH,
    align: "center",
  });
  y = doc.y + 18;

  // ---------- Tabla de datos de la reunión ----------
  const fullRowHeight = 22;
  drawGridRow(doc, MARGIN, y, [{ text: `REFERENCIA: PROYECTO ${clientName.toUpperCase()}`, width: CONTENT_WIDTH, bold: true }], fullRowHeight);
  y += fullRowHeight;

  const halfWidth = CONTENT_WIDTH / 2;
  drawGridRow(
    doc,
    MARGIN,
    y,
    [
      { text: `FECHA: ${formatDate(today)}`, width: halfWidth },
      { text: `ACTIVIDAD: Paz y Salvo Corte ${corteLabel}`, width: halfWidth },
    ],
    fullRowHeight,
  );
  y += fullRowHeight;

  // Ancho completo: el nombre del CEDI es texto libre y puede ser largo — a
  // media columna se desborda de la celda con nombres como "DROGUERIA MIXTA
  // PARQUE ALEGRA".
  drawGridRow(doc, MARGIN, y, [{ text: `MODERADOR: NODO ${cediName}`, width: CONTENT_WIDTH }], fullRowHeight);
  y += fullRowHeight + 18;
  doc.y = y;
  doc.x = MARGIN;

  // ---------- Agenda ----------
  doc.font("Helvetica-Bold").fontSize(10.5).fillColor(BLACK).text("AGENDA", MARGIN, doc.y);
  doc.moveDown(0.4);
  doc.font("Helvetica").fontSize(10).text(`1. Paz y salvo correspondiente a corte ${corteLabel}`, MARGIN, doc.y, {
    width: CONTENT_WIDTH,
  });
  doc.moveDown(1);

  // ---------- Desarrollo de la agenda ----------
  doc.font("Helvetica-Bold").fontSize(10.5).text("DESARROLLO DE LA AGENDA", MARGIN, doc.y);
  doc.moveDown(0.4);
  doc.font("Helvetica").fontSize(10).text(
    `Esta droguería confirma el retorno de las órdenes entregadas al equipo Quick correspondientes a los domicilios despachados del mes de ${monthName} del año en curso (1 de ${monthName} al ${corteLabel.split(" de ")[0]} de ${monthName}).`,
    MARGIN,
    doc.y,
    { width: CONTENT_WIDTH, align: "justify" },
  );
  doc.moveDown(0.6);
  doc.text(
    "Así mismo confirma las respectivas consignaciones correspondientes a los valores de domicilios y copagos.",
    MARGIN,
    doc.y,
    { width: CONTENT_WIDTH, align: "justify" },
  );
  doc.moveDown(1.5);

  // ---------- Firmas ----------
  doc.font("Helvetica-Bold").fontSize(10.5).text("EN CONSTANCIA DE LO ANTERIOR FIRMAN:", MARGIN, doc.y);
  doc.moveDown(0.6);

  const signHeaderHeight = 20;
  y = doc.y;
  drawGridRow(
    doc,
    MARGIN,
    y,
    [
      { text: "OPERADOR QUICK", width: halfWidth, bold: true },
      { text: clientName.toUpperCase(), width: halfWidth, bold: true },
    ],
    signHeaderHeight,
  );
  y += signHeaderHeight;

  const signBoxHeight = 70;
  drawGridRow(doc, MARGIN, y, [{ text: "", width: halfWidth }, { text: "", width: halfWidth }], signBoxHeight);

  // Firma de Yohan Mendoza dentro de la celda "OPERADOR QUICK".
  doc.image(getSignatureBuffer(), MARGIN + 14, y + 10, { width: halfWidth - 60 });
  doc.font("Helvetica").fontSize(9).fillColor(BLACK).text("Yohan Mendoza", MARGIN + 10, y + signBoxHeight - 16, {
    width: halfWidth - 20,
  });
  doc
    .font("Helvetica")
    .fontSize(9)
    .text("Nombre:", MARGIN + halfWidth + 10, y + signBoxHeight - 16, { width: halfWidth - 20 });

  y += signBoxHeight;
  doc.y = y + 20;
  doc.x = MARGIN;

  // ---------- Pie de página ----------
  // y=700 deja margen de sobra bajo el margen inferior de la página (792-45=747);
  // 740 quedaba a menos de una línea de ese límite y disparaba una página en blanco.
  doc.font("Helvetica").fontSize(8).fillColor("#6b7280").text("Página 1 de 1", MARGIN, 700, {
    width: CONTENT_WIDTH,
    align: "center",
  });

  doc.end();
  const buffer = await donePromise;

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="paz_y_salvo_${cityName}_${period}.pdf"`,
    },
  });
}
