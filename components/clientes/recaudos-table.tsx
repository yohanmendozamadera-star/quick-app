"use client";

import { formatCurrency, formatDate } from "@/lib/format";
import type { RecaudoRow } from "@/lib/recaudos/types";
import { RecaudoPhotoDialog } from "./recaudo-photo-dialog";

export function RecaudosTable({ clientId, rows, canUpload }: { clientId: string; rows: RecaudoRow[]; canUpload: boolean }) {
  const dates = new Map<string, Map<string, RecaudoRow[]>>();
  for (const row of rows) {
    const cities = dates.get(row.date) ?? new Map<string, RecaudoRow[]>();
    const key = row.cityId ?? "";
    cities.set(key,[...(cities.get(key) ?? []),row]);
    dates.set(row.date,cities);
  }
  if (!rows.length) return <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
    No hay recaudos sin novedad en las fechas y ciudad seleccionadas.
  </div>;
  const amount = (items: RecaudoRow[]) => items.reduce((sum,row) => sum + Number(row.amount),0);
  return <div className="space-y-4">
    {Array.from(dates).map(([date,cities]) => <section key={date} className="overflow-hidden rounded-lg border">
      <div className="flex flex-wrap items-center justify-between gap-2 bg-muted/50 px-4 py-3">
        <h2 className="font-semibold">{formatDate(date)}</h2>
        <span className="font-semibold">{formatCurrency(amount(Array.from(cities.values()).flat()))}</span>
      </div>
      {Array.from(cities).map(([cityId,items]) => <details key={cityId} className="border-t">
        <summary className="cursor-pointer px-4 py-3 text-sm hover:bg-muted/30">
          <span className="ml-2 font-medium">{items[0].cityName}</span>
          <span className="ml-3 text-muted-foreground">{items.length} droguería{items.length === 1 ? "" : "s"}</span>
          <span className="float-right font-medium">{formatCurrency(amount(items))}</span>
        </summary>
        <div className="overflow-x-auto px-4 pb-4">
          <table className="w-full text-sm">
            <thead className="border-b text-left text-muted-foreground"><tr>
              <th className="px-3 py-2">Droguería</th>
              <th className="px-3 py-2 text-right">Guías sin novedad</th>
              <th className="px-3 py-2 text-right">Total recaudado</th>
              <th className="px-3 py-2">Consignación</th>
            </tr></thead>
            <tbody>{items.map(row => <tr key={row.cediName} className="border-b last:border-0">
              <td className="px-3 py-3 font-medium">{row.cediName || "Sin droguería"}</td>
              <td className="px-3 py-3 text-right">{Number(row.guideCount).toLocaleString("es-CO")}</td>
              <td className="whitespace-nowrap px-3 py-3 text-right">{formatCurrency(Number(row.amount))}</td>
              <td className="px-3 py-3"><RecaudoPhotoDialog clientId={clientId} row={row} canUpload={canUpload} /></td>
            </tr>)}</tbody>
          </table>
        </div>
      </details>)}
    </section>)}
  </div>;
}
