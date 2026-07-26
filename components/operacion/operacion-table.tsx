"use client";

import { Fragment, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { OperacionCityRow } from "@/lib/operacion/types";
import type { CatalogOption } from "@/lib/catalog/queries";

function Cell({ value }: { value: number }) {
  if (value === 0) return <span className="text-muted-foreground">—</span>;
  return <span className="font-medium">{value.toLocaleString("es-CO")}</span>;
}

export function OperacionTable({
  cityRows,
  cities,
}: {
  cityRows: OperacionCityRow[];
  cities: CatalogOption[];
}) {
  const [expanded, setExpanded] = useState(false);

  const cityName = (id: string) => cities.find((c) => c.id === id)?.name ?? "Sin ciudad";

  const totals = cityRows.reduce(
    (acc, row) => {
      acc.recoleccion += row.recoleccion;
      acc.noConciliados += row.noConciliados;
      acc.tipoServicio += row.tipoServicio;
      acc.disponibilidad += row.disponibilidad;
      acc.adicionales += row.adicionales;
      return acc;
    },
    { recoleccion: 0, noConciliados: 0, tipoServicio: 0, disponibilidad: 0, adicionales: 0 },
  );

  const hasData = cityRows.length > 0;

  return (
    <div className="overflow-auto rounded-lg border bg-background">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
          <tr>
            <th className="w-8 px-3 py-2.5" />
            <th className="px-3 py-2.5">Ciudad</th>
            <th className="px-3 py-2.5">Recolección</th>
            <th className="px-3 py-2.5">No conciliados</th>
            <th className="px-3 py-2.5">Tipo Servicio</th>
            <th className="px-3 py-2.5">Disponibilidad</th>
            <th className="px-3 py-2.5">Adicionales</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {!hasData && (
            <tr>
              <td colSpan={7} className="px-3 py-10 text-center text-muted-foreground">
                No hay operación registrada en este rango de fechas.
              </td>
            </tr>
          )}
          {hasData && (
            <Fragment>
              <tr
                className="cursor-pointer hover:bg-muted/30"
                onClick={() => setExpanded((v) => !v)}
              >
                <td className="px-3 py-2.5 text-muted-foreground">
                  {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                </td>
                <td className="px-3 py-2.5 font-semibold">Consolidado</td>
                <td className="px-3 py-2.5 font-semibold">
                  <Cell value={totals.recoleccion} />
                </td>
                <td className="px-3 py-2.5 font-semibold">
                  <Cell value={totals.noConciliados} />
                </td>
                <td className="px-3 py-2.5 font-semibold">
                  <Cell value={totals.tipoServicio} />
                </td>
                <td className="px-3 py-2.5 font-semibold">
                  <Cell value={totals.disponibilidad} />
                </td>
                <td className="px-3 py-2.5 font-semibold">
                  <Cell value={totals.adicionales} />
                </td>
              </tr>
              {expanded &&
                cityRows.map((row) => (
                  <tr key={row.cityId} className="bg-muted/10">
                    <td className="px-3 py-2.5" />
                    <td className="px-3 py-2.5 pl-6 text-muted-foreground">{cityName(row.cityId)}</td>
                    <td className="px-3 py-2.5">
                      <Cell value={row.recoleccion} />
                    </td>
                    <td className="px-3 py-2.5">
                      <Cell value={row.noConciliados} />
                    </td>
                    <td className="px-3 py-2.5">
                      <Cell value={row.tipoServicio} />
                    </td>
                    <td className="px-3 py-2.5">
                      <Cell value={row.disponibilidad} />
                    </td>
                    <td className="px-3 py-2.5">
                      <Cell value={row.adicionales} />
                    </td>
                  </tr>
                ))}
            </Fragment>
          )}
        </tbody>
      </table>
    </div>
  );
}
