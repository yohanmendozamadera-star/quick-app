"use client";

// Recuerda los filtros (query string) de cada módulo mientras dura la
// sesión del navegador, para que ir y volver entre módulos por el menú
// lateral no los borre. sessionStorage se limpia solo al cerrar la pestaña,
// y además la borramos explícitamente al cerrar sesión, para que un inicio
// de sesión nuevo siempre arranque con los valores por defecto.
const PREFIX = "quick:filters:";

export function saveFiltersForPath(path: string, search: string) {
  try {
    if (search) sessionStorage.setItem(PREFIX + path, search);
    else sessionStorage.removeItem(PREFIX + path);
  } catch {
    // sessionStorage no disponible (modo privado, SSR, etc.) — no es crítico.
  }
}

export function getFiltersForPath(path: string): string | null {
  try {
    return sessionStorage.getItem(PREFIX + path);
  } catch {
    return null;
  }
}

export function clearAllSavedFilters() {
  try {
    Object.keys(sessionStorage)
      .filter((key) => key.startsWith(PREFIX))
      .forEach((key) => sessionStorage.removeItem(key));
  } catch {
    // ignorar
  }
}
