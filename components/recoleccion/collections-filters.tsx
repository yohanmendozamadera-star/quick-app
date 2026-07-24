"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getTodayBogota } from "@/lib/format";
import { saveFiltersForPath } from "@/lib/session-nav-filters";
import type { CatalogOption } from "@/lib/catalog/queries";

const RECONCILIATION_STATUSES = [
  { value: "no_conciliado", label: "No conciliado" },
  { value: "conciliado", label: "Conciliado" },
];

export function CollectionsFilters({
  clients,
  cities,
  loadTypes,
}: {
  clients: CatalogOption[];
  cities: CatalogOption[];
  loadTypes: CatalogOption[];
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

  // A diferencia de updateParam, esta SIEMPRE deja el parámetro en la URL
  // (incluso vacío) para distinguir "el usuario borró la fecha a propósito"
  // de "todavía no ha tocado el filtro" (que por defecto muestra hoy).
  const updateDateParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set(key, value);
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  };

  const dateFromValue = searchParams.has("from") ? (searchParams.get("from") ?? "") : getTodayBogota();
  const dateToValue = searchParams.has("to") ? (searchParams.get("to") ?? "") : getTodayBogota();

  // Recuerda los filtros actuales para que, si vas a otro módulo y regresas
  // por el menú, se restauren en vez de reiniciar a los valores por defecto.
  useEffect(() => {
    saveFiltersForPath(pathname, searchParams.toString());
  }, [pathname, searchParams]);

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

  const selectedLoadTypes = (searchParams.get("loadTypes") ?? "").split(",").filter(Boolean);
  const toggleLoadType = (id: string) => {
    const next = selectedLoadTypes.includes(id)
      ? selectedLoadTypes.filter((v) => v !== id)
      : [...selectedLoadTypes, id];
    updateParam("loadTypes", next.join(","));
  };

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
          <Label htmlFor="from">Desde</Label>
          <Input
            id="from"
            type="date"
            key={dateFromValue}
            defaultValue={dateFromValue}
            onChange={(e) => updateDateParam("from", e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="to">Hasta</Label>
          <Input
            id="to"
            type="date"
            key={dateToValue}
            defaultValue={dateToValue}
            onChange={(e) => updateDateParam("to", e.target.value)}
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
          <Label htmlFor="status">Estado de conciliación</Label>
          <select
            id="status"
            className="h-9 w-full rounded-md border bg-transparent px-2 text-sm"
            defaultValue={searchParams.get("status") ?? ""}
            onChange={(e) => updateParam("status", e.target.value)}
          >
            <option value="">Todos</option>
            {RECONCILIATION_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <Label htmlFor="opportunity">Oportunidad</Label>
          <select
            id="opportunity"
            className="h-9 w-full rounded-md border bg-transparent px-2 text-sm"
            defaultValue={searchParams.get("opportunity") ?? ""}
            onChange={(e) => updateParam("opportunity", e.target.value)}
          >
            <option value="">Todas</option>
            <option value="3">Más de 3 días sin conciliar</option>
            <option value="5">Más de 5 días sin conciliar</option>
          </select>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground">Tipo de carga</span>
        {loadTypes.map((l) => {
          const active = selectedLoadTypes.includes(l.id);
          return (
            <button
              key={l.id}
              type="button"
              onClick={() => toggleLoadType(l.id)}
              aria-pressed={active}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input text-muted-foreground hover:bg-muted",
              )}
            >
              {l.name}
            </button>
          );
        })}

        {hasFilters && (
          <Button type="button" variant="ghost" size="sm" onClick={clearFilters} className="ml-auto gap-1">
            <X className="size-4" />
            Limpiar filtros
          </Button>
        )}
      </div>
    </div>
  );
}
