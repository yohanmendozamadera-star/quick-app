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

let cachedSignature: Buffer | null = null;

/** Firma de Yohan Mendoza para el Paz y Salvo generado automáticamente. */
export function getSignatureBuffer(): Buffer {
  if (!cachedSignature) {
    cachedSignature = readFileSync(join(process.cwd(), "public", "firma-yohan-mendoza.png"));
  }
  return cachedSignature;
}

let cachedColsubsidioLogo: Buffer | null = null;

/** Logo de Colsubsidio, usado en el Paz y Salvo cuando el cliente es Colsubsidio. */
export function getColsubsidioLogoBuffer(): Buffer {
  if (!cachedColsubsidioLogo) {
    cachedColsubsidioLogo = readFileSync(join(process.cwd(), "public", "logo-colsubsidio.png"));
  }
  return cachedColsubsidioLogo;
}
