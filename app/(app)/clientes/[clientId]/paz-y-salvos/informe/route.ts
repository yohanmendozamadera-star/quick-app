import PDFDocument from "pdfkit";
import { getCurrentUser, can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { getAllCities, getAllCedis } from "@/lib/catalog/queries";
import { getTodayBogota } from "@/lib/format";

const PAGE_WIDTH = 612;
const MARGIN = 50;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const BLACK = "#000000";
const MUTED = "#4b5563";

function monthEndIso(period: string) {
  const date = new Date(`${period}T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + 1);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
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

  const [cities, cedis] = await Promise.all([getAllCities(), getAllCedis()]);
  const cityName = cities.find((c) => c.id === cityId)?.name ?? "Ciudad";
  const cediName = cedis.find((c) => c.code === cediCode)?.name ?? cediCode;

  const supabase = await createClient();
  const monthEnd = monthEndIso(period);

  const { count: pendingCount } = await supabase
    .from("collections")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId)
    .eq("city_id", cityId)
    .eq("cedi_code", cediCode)
    .eq("reconciliation_status", "no_conciliado")
    .gte("service_date", period)
    .lte("service_date", monthEnd)
    .is("deleted_at", null);

  if ((pendingCount ?? 0) > 0) {
    return new Response(
      "Este CEDI todavía tiene órdenes pendientes de conciliar en este mes — no se puede generar el Paz y Salvo hasta que quede en 0.",
      { status: 409 },
    );
  }

  const periodLabel = new Intl.DateTimeFormat("es-CO", { month: "long", year: "numeric" }).format(
    new Date(`${period}T00:00:00`),
  );

  const today = new Date(`${getTodayBogota()}T00:00:00`);
  const todayMonthName = new Intl.DateTimeFormat("es-CO", { month: "long" }).format(today);
  const dateLine = `${cityName} ${today.getDate()} de ${todayMonthName} de ${today.getFullYear()}`;

  const doc = new PDFDocument({ margin: MARGIN, size: "letter" });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk) => chunks.push(chunk));
  const donePromise = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  // ---------- Encabezado: fecha (izq.) y datos de la empresa (der.) ----------
  const headerY = MARGIN;
  doc.font("Helvetica").fontSize(11).fillColor(BLACK).text(dateLine, MARGIN, headerY, { width: 260 });

  doc.font("Helvetica-Bold").fontSize(20).text("Quick", MARGIN + 340, headerY, { width: 130, align: "right" });
  doc
    .font("Helvetica-Oblique")
    .fontSize(8)
    .fillColor(MUTED)
    .text("Transversal 93 N 51-98 Bodega 24-25", MARGIN + 260, headerY + 26, { width: 210, align: "right" })
    .text("Complejo empresarial Puertas del sol", MARGIN + 260, headerY + 37, { width: 210, align: "right" })
    .text("Quick Help SAS Nit: 830124778-5", MARGIN + 260, headerY + 48, { width: 210, align: "right" });

  doc.fillColor(BLACK);
  doc.y = headerY + 80;
  doc.x = MARGIN;

  // ---------- Cuerpo de la carta ----------
  doc.moveDown(1.5);
  doc.font("Helvetica-Bold").fontSize(11).text("Señores", MARGIN, doc.y);
  doc.moveDown(1);
  doc.font("Helvetica-Bold").fontSize(11).text(cediName, MARGIN, doc.y);
  doc.moveDown(1);

  doc.font("Helvetica").fontSize(10.5).text(
    "Por medio de la presente se deja constancia de que la operación ",
    MARGIN,
    doc.y,
    { width: CONTENT_WIDTH, continued: true },
  );
  doc.font("Helvetica-Bold").text("CROSS DOCKING", { continued: true });
  doc.font("Helvetica").text(" se encuentra a ", { continued: true });
  doc.font("Helvetica-Bold").text(`paz y salvo correspondiente al mes de ${periodLabel}`, { continued: true });
  doc
    .font("Helvetica")
    .text(
      ", en lo relacionado con las consignaciones efectuadas por concepto de recaudos de cuotas moderadoras y/o domicilios.",
    );

  doc.moveDown(1);
  doc.font("Helvetica").fontSize(10.5).text(
    "De igual manera, se certifica el retorno oportuno de tirillas, soportes y demás papelería correspondiente, " +
      "así como la gestión de devoluciones de paquetes generadas durante la operación de distribución del punto ",
    MARGIN,
    doc.y,
    { width: CONTENT_WIDTH, continued: true },
  );
  doc.font("Helvetica-Bold").text(cediName);

  doc.moveDown(4);
  doc.font("Helvetica").fontSize(10.5).text("Cordialmente", MARGIN, doc.y);
  doc.moveDown(1);
  doc.text("Coordinador", MARGIN, doc.y);

  // ---------- Bloque de firmas ----------
  doc.moveDown(4);
  const signY = doc.y;
  const colWidth = CONTENT_WIDTH / 2 - 10;

  doc.font("Helvetica-Bold").fontSize(10).text("ENTREGA", MARGIN, signY, { continued: true });
  doc.font("Helvetica").text("_____________________________________");
  doc.font("Helvetica-Bold").text("RECIBE", MARGIN + colWidth + 20, signY, { continued: true });
  doc.font("Helvetica").text("____________________");

  const signLabelY = signY + 16;
  doc
    .font("Helvetica-Bold")
    .fontSize(9)
    .text("Coordinador Operación Quick", MARGIN, signLabelY, { width: colWidth });
  doc
    .font("Helvetica-Bold")
    .fontSize(9)
    .text("/Representante Punto Atención", MARGIN + colWidth + 20, signLabelY, { width: colWidth });

  // ---------- Pie de página ----------
  const footerY = 700;
  doc.font("Helvetica-Bold").fontSize(14).fillColor(BLACK).text("Quick", MARGIN, footerY);
  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor(MUTED)
    .text("La forma más fácil de hacer tu Logística — supply · express · clean · global", MARGIN + 60, footerY + 3);
  doc
    .font("Helvetica")
    .fontSize(8)
    .text("Tel: (+57) 747 0547 · Correo: sac@quick.com.co · www.quick.com.co", MARGIN, footerY + 20);

  doc.end();
  const buffer = await donePromise;

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="paz_y_salvo_${cediCode}_${period}.pdf"`,
    },
  });
}
