"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Trash2, Loader2 } from "lucide-react";
import type { ReconciliationRow, ReconciliationsFilters } from "@/lib/reconciliations/types";
import type { CatalogOption } from "@/lib/catalog/queries";
import { formatCurrency, formatDate } from "@/lib/format";
import { deleteReconciliation, bulkDeleteReconciliations, getMatchingIds } from "@/app/(app)/conciliacion/actions";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { SortLink } from "@/components/data-table/sort-link";
import { PaginationBar } from "@/components/data-table/pagination-bar";
import { ResizableCell } from "@/components/data-table/resizable-cell";
import { ReconciliationFormDialog } from "@/components/conciliacion/reconciliation-form-dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { AuditHistoryDialog } from "@/components/shared/audit-history-dialog";
import { PAGE_SIZE_OPTIONS } from "@/lib/reconciliations/types";

export function ReconciliationsTable({
  rows,
  count,
  page,
  pageSize,
  sortColumn,
  sortDirection,
  filters,
  canEdit,
  canDelete,
  canViewAudit,
  clients,
  cities,
  loadTypes,
}: {
  rows: ReconciliationRow[];
  count: number;
  page: number;
  pageSize: number;
  sortColumn: string;
  sortDirection: "asc" | "desc";
  filters: ReconciliationsFilters;
  canEdit: boolean;
  canDelete: boolean;
  canViewAudit: boolean;
  clients: CatalogOption[];
  cities: CatalogOption[];
  loadTypes: CatalogOption[];
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loadingAllIds, setLoadingAllIds] = useState(false);

  const allVisibleSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const someVisibleSelected = rows.some((r) => selected.has(r.id));
  const selectedIds = Array.from(selected);

  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) rows.forEach((r) => next.delete(r.id));
      else rows.forEach((r) => next.add(r.id));
      return next;
    });
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllFiltered = async () => {
    setLoadingAllIds(true);
    const ids = await getMatchingIds(filters);
    setLoadingAllIds(false);
    setSelected(new Set(ids));
  };

  const clearSelection = () => setSelected(new Set());

  const handleDelete = async (id: string) => {
    const result = await deleteReconciliation(id);
    if (!result.success) {
      toast.error("No se pudo eliminar", { description: result.message });
      return;
    }
    toast.success("Conciliación eliminada");
  };

  const handleBulkDelete = async () => {
    const result = await bulkDeleteReconciliations(selectedIds);
    if (!result.success) {
      toast.error("No se pudo eliminar", { description: result.message });
      return;
    }
    toast.success(
      `${result.affected} registro${result.affected === 1 ? "" : "s"} eliminado${result.affected === 1 ? "" : "s"}`,
    );
    clearSelection();
  };

  return (
    <div className="rounded-lg border bg-background">
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b bg-muted/50 px-4 py-2 text-sm">
          <span className="font-medium">
            {selected.size} seleccionado{selected.size === 1 ? "" : "s"}
          </span>

          {selected.size === rows.length && rows.length < count && (
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto p-0"
              onClick={selectAllFiltered}
              disabled={loadingAllIds}
            >
              {loadingAllIds && <Loader2 className="size-3.5 animate-spin" />}
              Seleccionar los {count} registros filtrados
            </Button>
          )}

          <div className="ml-auto flex flex-wrap gap-2">
            {canDelete && (
              <ConfirmDialog
                trigger={
                  <Button variant="outline" size="sm" className="text-destructive">
                    Eliminar
                  </Button>
                }
                title="¿Eliminar los registros seleccionados?"
                description={`Se eliminarán ${selected.size} registro(s). Las recolecciones enlazadas vuelven a quedar "No conciliado".`}
                confirmLabel="Eliminar"
                onConfirm={handleBulkDelete}
              />
            )}
            <Button type="button" variant="ghost" size="sm" onClick={clearSelection}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      <div className="max-h-[65vh] overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-background text-left text-xs text-muted-foreground shadow-[0_1px_0_0] shadow-border">
            <tr>
              <th className="w-10 px-3 py-2.5">
                <Checkbox
                  checked={allVisibleSelected}
                  indeterminate={someVisibleSelected && !allVisibleSelected}
                  onCheckedChange={toggleAll}
                  aria-label="Seleccionar todos los visibles"
                />
              </th>
              <th className="px-3 py-2.5">
                <SortLink column="service_number" label="N° servicio" currentSort={sortColumn} currentDir={sortDirection} />
              </th>
              <th className="px-3 py-2.5">Nombre cliente</th>
              <th className="px-3 py-2.5">Novedad</th>
              <th className="px-3 py-2.5">Ciudad</th>
              <th className="px-3 py-2.5">Código CEDI</th>
              <th className="px-3 py-2.5">Nombre CEDI</th>
              <th className="px-3 py-2.5">Dirección servicio</th>
              <th className="px-3 py-2.5">
                <SortLink column="service_date" label="Fecha servicio" currentSort={sortColumn} currentDir={sortDirection} />
              </th>
              <th className="px-3 py-2.5">Tipo de servicio</th>
              <th className="px-3 py-2.5">Documento cliente</th>
              <th className="px-3 py-2.5">
                <SortLink column="collection_amount" label="Recaudo" currentSort={sortColumn} currentDir={sortDirection} />
              </th>
              <th className="px-3 py-2.5">
                <SortLink column="reconciliation_date" label="Fecha Conciliación" currentSort={sortColumn} currentDir={sortDirection} />
              </th>
              {(canEdit || canDelete || canViewAudit) && <th className="px-3 py-2.5 text-right">Acciones</th>}
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.length === 0 && (
              <tr>
                <td colSpan={13} className="px-3 py-10 text-center text-muted-foreground">
                  No se encontraron conciliaciones con los filtros aplicados.
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-muted/30">
                <td className="px-3 py-2.5">
                  <Checkbox
                    checked={selected.has(row.id)}
                    onCheckedChange={() => toggleOne(row.id)}
                    aria-label={`Seleccionar ${row.service_number}`}
                  />
                </td>
                <td className="px-3 py-2.5 font-medium">{row.service_number}</td>
                <td className="px-3 py-2.5">
                  <ResizableCell value={row.client_name ?? "—"} />
                </td>
                <td className="px-3 py-2.5 text-muted-foreground">
                  <ResizableCell value={row.novedad ?? "—"} />
                </td>
                <td className="px-3 py-2.5">{row.city?.name ?? "—"}</td>
                <td className="px-3 py-2.5">{row.cedi_code ?? "—"}</td>
                <td className="px-3 py-2.5 text-muted-foreground">
                  <ResizableCell value={row.cedi_name ?? "—"} defaultWidth={200} />
                </td>
                <td className="px-3 py-2.5 text-muted-foreground">
                  <ResizableCell value={row.service_address ?? "—"} />
                </td>
                <td className="px-3 py-2.5">{formatDate(row.service_date)}</td>
                <td className="px-3 py-2.5">{row.load_type?.name ?? "—"}</td>
                <td className="px-3 py-2.5">{row.client_document ?? "—"}</td>
                <td className="px-3 py-2.5">{formatCurrency(row.collection_amount)}</td>
                <td className="px-3 py-2.5">{formatDate(row.reconciliation_date)}</td>
                {(canEdit || canDelete || canViewAudit) && (
                  <td className="px-3 py-2.5">
                    <div className="flex justify-end gap-1">
                      {canEdit && (
                        <ReconciliationFormDialog
                          reconciliation={row}
                          clients={clients}
                          cities={cities}
                          loadTypes={loadTypes}
                        />
                      )}
                      {canDelete && (
                        <ConfirmDialog
                          trigger={
                            <Button variant="ghost" size="icon-sm" aria-label="Eliminar">
                              <Trash2 className="size-4 text-destructive" />
                            </Button>
                          }
                          title="¿Eliminar esta conciliación?"
                          description={`¿Estás seguro de que deseas eliminar el registro ${row.service_number}? Si estaba conciliada, la recolección enlazada vuelve a quedar "No conciliado".`}
                          confirmLabel="Eliminar"
                          onConfirm={() => handleDelete(row.id)}
                        />
                      )}
                      {canViewAudit && (
                        <AuditHistoryDialog
                          module="reconciliations"
                          recordId={row.id}
                          recordLabel={row.service_number}
                        />
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <PaginationBar page={page} pageSize={pageSize} count={count} pageSizeOptions={PAGE_SIZE_OPTIONS} />
    </div>
  );
}
