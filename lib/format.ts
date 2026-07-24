const currencyFormatter = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat("es-CO", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat("es-CO", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatCurrency(value: number | null | undefined) {
  return currencyFormatter.format(value ?? 0);
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value.includes("T") ? value : `${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "—";
  return dateFormatter.format(date);
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return dateTimeFormatter.format(date);
}

const isoDatePartsFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Bogota",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Fecha de hoy en zona horaria de Colombia, en formato AAAA-MM-DD. */
export function getTodayBogota(): string {
  return isoDatePartsFormatter.format(new Date());
}

/** Fecha de hace N días (hora de Colombia), en formato AAAA-MM-DD. */
export function getDefaultDateFrom(daysAgo: number): string {
  const today = new Date(`${getTodayBogota()}T00:00:00Z`);
  today.setUTCDate(today.getUTCDate() - daysAgo);
  return isoDatePartsFormatter.format(today);
}

/** Día 1 del mes actual (hora de Colombia), en formato AAAA-MM-DD. */
export function getMonthStartBogota(): string {
  const todayIso = getTodayBogota();
  const [year, month] = todayIso.split("-");
  return `${year}-${month}-01`;
}

/** Horas trabajadas entre dos horarios "HH:mm" (ej. 08:00 a 17:00 = "9 h"). */
export function formatWorkedHours(startTime: string | null | undefined, endTime: string | null | undefined) {
  if (!startTime || !endTime) return "—";

  const [startH, startM] = startTime.split(":").map(Number);
  const [endH, endM] = endTime.split(":").map(Number);
  if ([startH, startM, endH, endM].some((n) => Number.isNaN(n))) return "—";

  const diffMinutes = endH * 60 + endM - (startH * 60 + startM);
  if (diffMinutes < 0) return "—";

  const hours = Math.floor(diffMinutes / 60);
  const minutes = diffMinutes % 60;
  return minutes === 0 ? `${hours} h` : `${hours} h ${minutes} min`;
}

/** Convierte "DD/MM/AAAA" a "AAAA-MM-DD". Devuelve null si no es una fecha válida. */
export function parseDdMmYyyy(input: string | undefined | null): string | null {
  if (!input) return null;
  const match = input.trim().match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const date = new Date(`${iso}T00:00:00Z`);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() + 1 !== month || date.getUTCDate() !== day) {
    return null;
  }
  return iso;
}
