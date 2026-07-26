"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { saveFiltersForPath } from "@/lib/session-nav-filters";
import { getTodayBogota } from "@/lib/format";
import type { CatalogOption } from "@/lib/catalog/queries";

const STATUSES = [
  { value: "no_verificado", label: "No verificado" },
  { value: "verificado", label: "Verificado" },
];

export function ServiceTypeFilters({
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

  // El parámetro siempre queda en la URL (incluso vacío) para distinguir
  // "el usuario lo borró a propósito" de "todavía no lo ha tocado" (que por
  // defecto muestra hoy).
  const updateDateParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set(key, value);
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  };

  const dateFromValue = searchParams.has("from") ? (searchParams.get("from") ?? "") : getTodayBogota();
  const dateToValue = searchParams.has("to") ? (searchParams.get("to") ?? "") : getTodayBogota();

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const timeout = setTimeout(() => updateParam("q", search), 400);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  useEffect(() => {
    saveFiltersForPath(pathname, searchParams.toString());
  }, [pathname, searchParams]);

  const clearFilters = () => {
    setSearch("");
    router.push(pathname);
  };

  const hasFilters = Array.from(searchParams.keys()).some((k) => k !== "sort" && k !== "dir" && k !== "pageSize");

  return (
    <div className="space-y-3 rounded-lg border bg-background p-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
        <div className="col-span-2 space-y-1 sm:col-span-3 lg:col-span-2">
          <Label htmlFor="search">Buscar por guía</Label>
          <Input id="search" placeholder="Guía…" value={search} onChange={(e) => setSearch(e.target.value)} />
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
          <Label htmlFor="loadType">Tipo de carga</Label>
          <select
            id="loadType"
            className="h-9 w-full rounded-md border bg-transparent px-2 text-sm"
            defaultValue={searchParams.get("loadType") ?? ""}
            onChange={(e) => updateParam("loadType", e.target.value)}
          >
            <option value="">Todos</option>
            {loadTypes.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground">Estado</span>
        <button
          type="button"
          onClick={() => updateParam("status", "")}
          aria-pressed={!searchParams.get("status")}
          className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
            !searchParams.get("status")
              ? "border-primary bg-primary text-primary-foreground"
              : "border-input text-muted-foreground hover:bg-muted"
          }`}
        >
          Todos
        </button>
        {STATUSES.map((s) => {
          const active = searchParams.get("status") === s.value;
          return (
            <button
              key={s.value}
              type="button"
              onClick={() => updateParam("status", active ? "" : s.value)}
              aria-pressed={active}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input text-muted-foreground hover:bg-muted"
              }`}
            >
              {s.label}
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
