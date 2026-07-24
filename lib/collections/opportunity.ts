import type { CollectionRow } from "./types";

const bogotaDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Bogota",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Convierte una fecha/hora ISO a su fecha calendario (AAAA-MM-DD) en hora de Colombia. */
function toBogotaDateOnly(iso: string) {
  return bogotaDateFormatter.format(new Date(iso));
}

/**
 * Días calendario completos entre dos fechas AAAA-MM-DD (nunca negativo).
 * Se compara solo la fecha, no la hora: si algo se cargó el 19 y hoy es el
 * 21, deben ser 2 días, sin importar a qué hora del 19 se haya cargado.
 */
function calendarDaysBetween(startDateOnly: string, endDateOnly: string) {
  const start = new Date(`${startDateOnly}T00:00:00Z`);
  const end = new Date(`${endDateOnly}T00:00:00Z`);
  const diffMs = end.getTime() - start.getTime();
  return Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));
}

/**
 * Días transcurridos desde que la guía se cargó al sistema (created_at) sin
 * conciliarse. El contador se detiene el día en que queda "Conciliado".
 */
export function computeOpportunityDays(
  row: Pick<CollectionRow, "created_at" | "reconciliation_status" | "reconciled_at">,
) {
  const startDateOnly = toBogotaDateOnly(row.created_at);
  const endDateOnly =
    row.reconciliation_status === "conciliado" && row.reconciled_at
      ? toBogotaDateOnly(row.reconciled_at)
      : toBogotaDateOnly(new Date().toISOString());
  return calendarDaysBetween(startDateOnly, endDateOnly);
}
