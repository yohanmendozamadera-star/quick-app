"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getTodayBogota } from "@/lib/format";
import { saveFiltersForPath } from "@/lib/session-nav-filters";
import type { CatalogOption } from "@/lib/catalog/queries";

function currentMonth() {
  return getTodayBogota().slice(0, 7);
}

export function PazSalvoFilters({ cities }: { cities: CatalogOption[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const updateParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`${pathname}?${params.toString()}`);
  };

  const monthFromValue = searchParams.has("from") ? (searchParams.get("from") ?? "") : currentMonth();
  const monthToValue = searchParams.has("to") ? (searchParams.get("to") ?? "") : currentMonth();

  useEffect(() => {
    saveFiltersForPath(pathname, searchParams.toString());
  }, [pathname, searchParams]);

  return (
    <div className="grid grid-cols-2 gap-3 rounded-lg border bg-background p-4 sm:max-w-2xl sm:grid-cols-3">
      <div className="space-y-1">
        <Label htmlFor="from">Desde (mes)</Label>
        <Input
          id="from"
          type="month"
          key={monthFromValue}
          defaultValue={monthFromValue}
          onChange={(e) => updateParam("from", e.target.value)}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="to">Hasta (mes)</Label>
        <Input
          id="to"
          type="month"
          key={monthToValue}
          defaultValue={monthToValue}
          onChange={(e) => updateParam("to", e.target.value)}
        />
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
    </div>
  );
}
