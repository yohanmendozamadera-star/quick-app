"use client";

import { Fragment, useState } from "react";
import { ChevronDown, ChevronRight, Download } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/format";
import type { ConsolidadoDateRow, ConsolidadoCediRow } from "@/lib/consolidado/types";
import type { CatalogOption } from "@/lib/catalog/queries";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Totals = {
  recoleccionCount: number;
  recoleccionAmount: number;
  conciliadoCount: number;
  conciliadoAmount: number;
  pendienteCount: number;
  pendienteAmount: number;
};

function emptyTotals(): Totals {
  return {
    recoleccionCount: 0,
    recoleccionAmount: 0,
    conciliadoCount: 0,
    conciliadoAmount: 0,
    pendienteCount: 0,
    pendienteAmount: 0,
  };
}

function addTotals(acc: Totals, row: Totals): Totals {
  return {
    recoleccionCount: acc.recoleccionCount + row.recoleccionCount,
    recoleccionAmount: acc.recoleccionAmount + row.recoleccionAmount,
    conciliadoCount: acc.conciliadoCount + row.conciliadoCount,
    conciliadoAmount: acc.conciliadoAmount + row.conciliadoAmount,
    pendienteCount: acc.pendienteCount + row.pendienteCount,
    pendienteAmount: acc.pendienteAmount + row.pendienteAmount,
  };
}

function Metric({ count, amount }: { count: number; amount: number }) {
  if (count === 0) return <span className="text-muted-foreground">—</span>;
  return (
    <div>
      <span className="font-medium">{count.toLocaleString("es-CO")}</span>
      <span className="ml-1 text-xs text-muted-foreground">{formatCurrency(amount)}</span>
    </div>
  );
}

function EstadoBadge({ pendienteCount }: { pendienteCount: number }) {
  if (pendienteCount > 0) {
    return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Abierto</Badge>;
  }
  return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Cerrado</Badge>;
}

function MetricCells({ totals }: { totals: Totals }) {
  return (
    <>
      <td className="px-3 py-2.5">
        <Metric count={totals.recoleccionCount} amount={totals.recoleccionAmount} />
      </td>
      <td className="px-3 py-2.5">
        <Metric count={totals.conciliadoCount} amount={totals.conciliadoAmount} />
      </td>
      <td className="px-3 py-2.5">
        <Metric count={totals.pendienteCount} amount={totals.pendienteAmount} />
      </td>
      <td className="px-3 py-2.5">
        <EstadoBadge pendienteCount={totals.pendienteCount} />
      </td>
    </>
  );
}

export function ConsolidadoTable({
  clientId,
  dateRows,
  cities,
}: {
  clientId: string;
  dateRows: ConsolidadoDateRow[];
  cities: CatalogOption[];
}) {
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());
  const [expandedCities, setExpandedCities] = useState<Set<string>>(new Set());

  const toggleDate = (date: string) => {
    setExpandedDates((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  };

  const toggleCity = (key: string) => {
    setExpandedCities((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const cityName = (id: string) => cities.find((c) => c.id === id)?.name ?? "Sin ciudad";

  const cediTotals = (c: ConsolidadoCediRow): Totals => ({
    recoleccionCount: c.recoleccionCount,
    recoleccionAmount: c.recoleccionAmount,
    conciliadoCount: c.conciliadoCount,
    conciliadoAmount: c.conciliadoAmount,
    pendienteCount: c.pendienteCount,
    pendienteAmount: c.pendienteAmount,
  });

  return (
    <div className="overflow-auto rounded-lg border bg-background">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
          <tr>
            <th className="w-8 px-3 py-2.5" />
            <th className="px-3 py-2.5">Fecha / Ciudad / CEDI</th>
            <th className="px-3 py-2.5">Total recolectado</th>
            <th className="px-3 py-2.5">Total conciliado</th>
            <th className="px-3 py-2.5">Total pendientes</th>
            <th className="px-3 py-2.5">Estado</th>
            <th className="w-10 px-3 py-2.5" />
          </tr>
        </thead>
        <tbody className="divide-y">
          {dateRows.length === 0 && (
            <tr>
              <td colSpan={7} className="px-3 py-10 text-center text-muted-foreground">
                No hay conciliaciones registradas en este rango de fechas.
              </td>
            </tr>
          )}
          {dateRows.map((dateRow) => {
            const dateOpen = expandedDates.has(dateRow.date);
            const dateTotals = dateRow.cities
              .flatMap((c) => c.cedis)
              .reduce((acc, c) => addTotals(acc, cediTotals(c)), emptyTotals());

            return (
              <Fragment key={dateRow.date}>
                <tr className="cursor-pointer hover:bg-muted/30" onClick={() => toggleDate(dateRow.date)}>
                  <td className="px-3 py-2.5 text-muted-foreground">
                    {dateOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                  </td>
                  <td className="px-3 py-2.5 font-semibold">{formatDate(dateRow.date)}</td>
                  <MetricCells totals={dateTotals} />
                  <td className="px-3 py-2.5" />
                </tr>

                {dateOpen &&
                  dateRow.cities.map((cityRow) => {
                    const cityKey = `${dateRow.date}|${cityRow.cityId}`;
                    const cityOpen = expandedCities.has(cityKey);
                    const cityTotals = cityRow.cedis.reduce((acc, c) => addTotals(acc, cediTotals(c)), emptyTotals());

                    return (
                      <Fragment key={cityKey}>
                        <tr
                          className="cursor-pointer bg-muted/10 hover:bg-muted/30"
                          onClick={() => toggleCity(cityKey)}
                        >
                          <td className="px-3 py-2.5" />
                          <td className="px-3 py-2.5 pl-6 font-medium text-muted-foreground">
                            <span className="mr-1 inline-flex align-middle">
                              {cityOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                            </span>
                            {cityName(cityRow.cityId)}
                          </td>
                          <MetricCells totals={cityTotals} />
                          <td className="px-3 py-2.5" />
                        </tr>

                        {cityOpen &&
                          cityRow.cedis.map((cedi) => {
                            const pendientesParams = new URLSearchParams({
                              date: dateRow.date,
                              cityId: cityRow.cityId,
                              cediCode: cedi.cediCode,
                              cediName: cedi.cediName ?? cedi.cediCode,
                            });
                            return (
                              <tr key={cedi.cediCode} className="bg-muted/5">
                                <td className="px-3 py-2.5" />
                                <td className="px-3 py-2.5 pl-12 text-muted-foreground">
                                  {cedi.cediName ?? cedi.cediCode} ({cedi.cediCode})
                                </td>
                                <MetricCells totals={cediTotals(cedi)} />
                                <td className="px-3 py-2.5">
                                  <a
                                    href={`/clientes/${clientId}/consolidado/pendientes?${pendientesParams.toString()}`}
                                    aria-label="Descargar pendientes de esta fecha"
                                    className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }))}
                                  >
                                    <Download className="size-4" />
                                  </a>
                                </td>
                              </tr>
                            );
                          })}
                      </Fragment>
                    );
                  })}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
