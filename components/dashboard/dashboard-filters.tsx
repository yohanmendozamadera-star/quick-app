"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getMonthStartBogota, getTodayBogota } from "@/lib/format";
import { saveFiltersForPath } from "@/lib/session-nav-filters";

export function DashboardFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const updateDateParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set(key, value);
    router.push(`${pathname}?${params.toString()}`);
  };

  const dateFromValue = searchParams.has("from") ? (searchParams.get("from") ?? "") : getMonthStartBogota();
  const dateToValue = searchParams.has("to") ? (searchParams.get("to") ?? "") : getTodayBogota();

  useEffect(() => {
    saveFiltersForPath(pathname, searchParams.toString());
  }, [pathname, searchParams]);

  return (
    <div className="grid grid-cols-2 gap-3 rounded-lg border bg-background p-4 sm:max-w-md">
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
    </div>
  );
}
