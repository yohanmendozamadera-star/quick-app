"use client";

import { Fragment, useState } from "react";
import { ChevronDown, ChevronRight, FileText, CheckCircle2 } from "lucide-react";
import { formatCurrency, formatDateTime } from "@/lib/format";
import type { PazSalvoPeriodRow } from "@/lib/paz-salvo/types";
import type { CatalogOption } from "@/lib/catalog/queries";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { PazSalvoUploadDialog } from "@/components/clientes/paz-salvo-upload-dialog";
import { cn } from "@/lib/utils";

const monthFormatter = new Intl.DateTimeFormat("es-CO", { month: "long", year: "numeric" });

function formatPeriod(period: string) {
  const date = new Date(`${period}T00:00:00`);
  if (Number.isNaN(date.getTime())) return period;
  const label = monthFormatter.format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function PazSalvoTable({
  clientId,
  periodRows,
  cities,
}: {
  clientId: string;
  periodRows: PazSalvoPeriodRow[];
  cities: CatalogOption[];
}) {
  const [expandedPeriods, setExpandedPeriods] = useState<Set<string>>(new Set());
  const [expandedCities, setExpandedCities] = useState<Set<string>>(new Set());

  const togglePeriod = (period: string) => {
    setExpandedPeriods((prev) => {
      const next = new Set(prev);
      if (next.has(period)) next.delete(period);
      else next.add(period);
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

  return (
    <div className="overflow-auto rounded-lg border bg-background">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
          <tr>
            <th className="w-8 px-3 py-2.5" />
            <th className="px-3 py-2.5">Mes / Ciudad / CEDI</th>
            <th className="px-3 py-2.5">Total recolectado</th>
            <th className="px-3 py-2.5">Estado</th>
            <th className="px-3 py-2.5">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {periodRows.length === 0 && (
            <tr>
              <td colSpan={5} className="px-3 py-10 text-center text-muted-foreground">
                No hay recolecciones registradas en este rango de meses.
              </td>
            </tr>
          )}
          {periodRows.map((periodRow) => {
            const periodOpen = expandedPeriods.has(periodRow.period);
            const cedis = periodRow.cities.flatMap((c) => c.cedis);
            const totalAmount = cedis.reduce((sum, c) => sum + c.totalAmount, 0);
            const pendingAmount = cedis.reduce((sum, c) => sum + c.pendingAmount, 0);

            return (
              <Fragment key={periodRow.period}>
                <tr className="cursor-pointer hover:bg-muted/30" onClick={() => togglePeriod(periodRow.period)}>
                  <td className="px-3 py-2.5 text-muted-foreground">
                    {periodOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                  </td>
                  <td className="px-3 py-2.5 font-semibold">{formatPeriod(periodRow.period)}</td>
                  <td className="px-3 py-2.5 font-medium">{formatCurrency(totalAmount)}</td>
                  <td className="px-3 py-2.5">
                    {pendingAmount === 0 ? (
                      <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Paz y Salvo</Badge>
                    ) : (
                      <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
                        Debe {formatCurrency(pendingAmount)}
                      </Badge>
                    )}
                  </td>
                  <td className="px-3 py-2.5" />
                </tr>

                {periodOpen &&
                  periodRow.cities.map((cityRow) => {
                    const cityKey = `${periodRow.period}|${cityRow.cityId}`;
                    const cityOpen = expandedCities.has(cityKey);
                    const cityTotalAmount = cityRow.cedis.reduce((sum, c) => sum + c.totalAmount, 0);
                    const cityPendingAmount = cityRow.cedis.reduce((sum, c) => sum + c.pendingAmount, 0);

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
                          <td className="px-3 py-2.5">{formatCurrency(cityTotalAmount)}</td>
                          <td className="px-3 py-2.5">
                            {cityPendingAmount === 0 ? (
                              <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                                Paz y Salvo
                              </Badge>
                            ) : (
                              <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
                                Debe {formatCurrency(cityPendingAmount)}
                              </Badge>
                            )}
                          </td>
                          <td className="px-3 py-2.5" />
                        </tr>

                        {cityOpen &&
                          cityRow.cedis.map((cedi) => {
                            const documentType = cedi.pendingAmount === 0 ? "paz_y_salvo" : "compromiso";
                            const informeParams = new URLSearchParams({
                              cediCode: cedi.cediCode,
                              cityId: cityRow.cityId,
                              period: periodRow.period,
                            });

                            return (
                              <tr key={cedi.cediCode} className="bg-muted/5">
                                <td className="px-3 py-2.5" />
                                <td className="px-3 py-2.5 pl-12 text-muted-foreground">
                                  {cedi.cediName ?? cedi.cediCode} ({cedi.cediCode})
                                </td>
                                <td className="px-3 py-2.5">{formatCurrency(cedi.totalAmount)}</td>
                                <td className="px-3 py-2.5">
                                  {cedi.pendingAmount === 0 ? (
                                    <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                                      Paz y Salvo
                                    </Badge>
                                  ) : (
                                    <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
                                      Debe {formatCurrency(cedi.pendingAmount)}
                                    </Badge>
                                  )}
                                </td>
                                <td className="px-3 py-2.5">
                                  <div className="flex items-center gap-1">
                                    <a
                                      href={`/clientes/${clientId}/paz-y-salvos/informe?${informeParams.toString()}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      aria-label="Generar documento"
                                      className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }))}
                                    >
                                      <FileText className="size-4" />
                                    </a>
                                    <PazSalvoUploadDialog
                                      clientId={clientId}
                                      cityId={cityRow.cityId}
                                      cediCode={cedi.cediCode}
                                      cediName={cedi.cediName}
                                      period={periodRow.period}
                                      documentType={documentType}
                                    />
                                    {cedi.document && (
                                      <span title={`Firmado el ${formatDateTime(cedi.document.uploadedAt)}`}>
                                        <CheckCircle2 className="size-4 text-emerald-600" />
                                      </span>
                                    )}
                                  </div>
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
