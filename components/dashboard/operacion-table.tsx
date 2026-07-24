"use client";

import { Fragment, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { DashboardDateRow } from "@/lib/dashboard/types";
import type { CatalogOption } from "@/lib/catalog/queries";

function Cell({ value, manual }: { value: number; manual: number }) {
  if (value === 0) return <span className="text-muted-foreground">—</span>;
  return (
    <div>
      <span className="font-medium">{value.toLocaleString("es-CO")}</span>
      {manual !== 0 && (
        <span className="ml-1 text-xs text-muted-foreground">
          ({manual > 0 ? "+" : ""}
          {manual.toLocaleString("es-CO")} manual)
        </span>
      )}
    </div>
  );
}

export function OperacionTable({
  dateRows,
  clients,
  cities,
}: {
  dateRows: DashboardDateRow[];
  clients: CatalogOption[];
  cities: CatalogOption[];
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (date: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  };

  const cityName = (id: string) => cities.find((c) => c.id === id)?.name ?? "Sin ciudad";

  const grandTotalsByClient: Record<string, number> = {};
  let grandTotal = 0;
  for (const row of dateRows) {
    for (const client of clients) {
      const v = row.totalsByClient[client.id];
      if (v) grandTotalsByClient[client.id] = (grandTotalsByClient[client.id] ?? 0) + v.automatic + v.manual;
    }
    grandTotal += row.total;
  }

  return (
    <div className="overflow-auto rounded-lg border bg-background">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
          <tr>
            <th className="w-8 px-3 py-2.5" />
            <th className="px-3 py-2.5">Fecha</th>
            {clients.map((c) => (
              <th key={c.id} className="px-3 py-2.5">
                {c.name}
              </th>
            ))}
            <th className="px-3 py-2.5">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {dateRows.length === 0 && (
            <tr>
              <td colSpan={clients.length + 3} className="px-3 py-10 text-center text-muted-foreground">
                No hay operación registrada en este rango de fechas.
              </td>
            </tr>
          )}
          {dateRows.map((row) => {
            const isOpen = expanded.has(row.date);
            return (
              <Fragment key={row.date}>
                <tr
                  className="cursor-pointer hover:bg-muted/30"
                  onClick={() => toggle(row.date)}
                >
                  <td className="px-3 py-2.5 text-muted-foreground">
                    {isOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                  </td>
                  <td className="px-3 py-2.5 font-medium">{formatDate(row.date)}</td>
                  {clients.map((c) => {
                    const v = row.totalsByClient[c.id] ?? { automatic: 0, manual: 0 };
                    return (
                      <td key={c.id} className="px-3 py-2.5">
                        <Cell value={v.automatic + v.manual} manual={v.manual} />
                      </td>
                    );
                  })}
                  <td className="px-3 py-2.5 font-semibold">{row.total.toLocaleString("es-CO")}</td>
                </tr>
                {isOpen && (
                  <tr key={`${row.date}-detail`}>
                    <td colSpan={clients.length + 3} className="bg-muted/20 px-3 py-3">
                      <p className="mb-2 px-2 text-xs font-medium text-muted-foreground">
                        Detalle por ciudad — {formatDate(row.date)}
                      </p>
                      <table className="w-full text-sm">
                        <thead className="text-left text-xs text-muted-foreground">
                          <tr>
                            <th className="px-2 py-1.5">Ciudad</th>
                            {clients.map((c) => (
                              <th key={c.id} className="px-2 py-1.5">
                                {c.name}
                              </th>
                            ))}
                            <th className="px-2 py-1.5">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60">
                          {row.cities.map((city) => (
                            <tr key={city.cityId}>
                              <td className="px-2 py-1.5 font-medium">{cityName(city.cityId)}</td>
                              {clients.map((c) => {
                                const v = city.totalsByClient[c.id] ?? { automatic: 0, manual: 0 };
                                return (
                                  <td key={c.id} className="px-2 py-1.5">
                                    <Cell value={v.automatic + v.manual} manual={v.manual} />
                                  </td>
                                );
                              })}
                              <td className="px-2 py-1.5 font-semibold">{city.total.toLocaleString("es-CO")}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
        {dateRows.length > 0 && (
          <tfoot>
            <tr className={cn("border-t-2 font-semibold")}>
              <td className="px-3 py-2.5" />
              <td className="px-3 py-2.5">Total</td>
              {clients.map((c) => (
                <td key={c.id} className="px-3 py-2.5">
                  {(grandTotalsByClient[c.id] ?? 0).toLocaleString("es-CO")}
                </td>
              ))}
              <td className="px-3 py-2.5">{grandTotal.toLocaleString("es-CO")}</td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
