"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { getTodayBogota } from "@/lib/format";
import { saveFiltersForPath } from "@/lib/session-nav-filters";
import type { CatalogOption, CediOption } from "@/lib/catalog/queries";

export function ReconciliationsFilters({
  clients,
  cities,
  cedis,
}: {
  clients: CatalogOption[];
  cities: CatalogOption[];
  cedis: CediOption[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const isFirstRender = useRef(true);

  const updateParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  };

  // Igual que en Recolección: el parámetro siempre queda en la URL (aunque
  // sea vacío) para distinguir "el usuario lo borró a propósito" de "todavía
  // no lo ha tocado" (que por defecto muestra hoy).
  const updateDateParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set(key, value);
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  };

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const timeout = setTimeout(() => updateParam("q", search), 400);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const clearFilters = () => {
    setSearch("");
    router.push(pathname);
  };

  const hasFilters = Array.from(searchParams.keys()).some((k) => k !== "sort" && k !== "dir" && k !== "pageSize");

  const dateFromValue = searchParams.has("cfrom") ? (searchParams.get("cfrom") ?? "") : getTodayBogota();
  const dateToValue = searchParams.has("cto") ? (searchParams.get("cto") ?? "") : getTodayBogota();
  const selectedCityId = searchParams.get("city") ?? "";
  const cediOptions = selectedCityId ? cedis.filter((c) => c.city_id === selectedCityId) : cedis;

  // Recuerda los filtros actuales para que, si vas a otro módulo y regresas
  // por el menú, se restauren en vez de reiniciar a los valores por defecto.
  useEffect(() => {
    saveFiltersForPath(pathname, searchParams.toString());
  }, [pathname, searchParams]);

  return (
    <div className="space-y-3 rounded-lg border bg-background p-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <div className="col-span-2 space-y-1 sm:col-span-3 lg:col-span-2">
          <Label htmlFor="search">Buscar</Label>
          <Input
            id="search"
            placeholder="N° servicio, documento, CEDI…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="cfrom">Fecha de conciliación desde</Label>
          <Input
            id="cfrom"
            type="date"
            key={dateFromValue}
            defaultValue={dateFromValue}
            onChange={(e) => updateDateParam("cfrom", e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="cto">Fecha de conciliación hasta</Label>
          <Input
            id="cto"
            type="date"
            key={dateToValue}
            defaultValue={dateToValue}
            onChange={(e) => updateDateParam("cto", e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="client">Cliente</Label>
          <select
            id="client"
            className="h-9 w-full rounded-md border bg-transparent px-2 text-sm"
            defaultValue={searchParams.get("client") ?? ""}
            onChange={(e) => updateParam("client", e.target.value)}
          >
            <option value="">Todos</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <Label htmlFor="city">Ciudad</Label>
          <select
            id="city"
            className="h-9 w-full rounded-md border bg-transparent px-2 text-sm"
            defaultValue={searchParams.get("city") ?? ""}
            onChange={(e) => updateParam("city", e.target.value)}
          >
            <option value="">Todas</option>
            {cities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <Label htmlFor="cedi">Nodo</Label>
          <select
            id="cedi"
            className="h-9 w-full rounded-md border bg-transparent px-2 text-sm"
            defaultValue={searchParams.get("cedi") ?? ""}
            onChange={(e) => updateParam("cedi", e.target.value)}
          >
            <option value="">Todos</option>
            {cediOptions.map((c) => (
              <option key={c.id} value={c.code}>
                {c.name} ({c.code})
              </option>
            ))}
          </select>
        </div>
      </div>

      {hasFilters && (
        <div className="flex justify-end">
          <Button type="button" variant="ghost" size="sm" onClick={clearFilters} className="gap-1">
            <X className="size-4" />
            Limpiar filtros
          </Button>
        </div>
      )}
    </div>
  );
}
