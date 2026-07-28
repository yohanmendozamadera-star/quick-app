import { readFileSync } from "fs";
import { join } from "path";

let cached: Buffer | null = null;

/** Logo de Quick para los PDFs generados (Acta, Paz y Salvo). */
export function getQuickLogoBuffer(): Buffer {
  if (!cached) {
    cached = readFileSync(join(process.cwd(), "public", "quick-logo.jpg"));
  }
  return cached;
}
