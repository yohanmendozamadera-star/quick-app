"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Trash2, Loader2 } from "lucide-react";
import type { AdditionalServiceRow, AdditionalServiceFilters, AdditionalServiceStatus } from "@/lib/additional-services/types";
import type { CatalogOption, CediOption } from "@/lib/catalog/queries";
import { formatDate, formatDateTime, formatWorkedHours } from "@/lib/format";
import { deleteAdditionalService, bulkDeleteAdditionalServices, getMatchingIds } from "@/app/(app)/adicionales/actions";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { SortLink } from "@/components/data-table/sort-link";
import { PaginationBar } from "@/components/data-table/pagination-bar";
import { ResizableCell } from "@/components/data-table/resizable-cell";
import { AdditionalServiceEditDialog } from "@/components/adicionales/additional-service-edit-dialog";
import { StatusChangeDialog } from "@/components/adicionales/status-change-dialog";
import { DuplicateButton } from "@/components/adicionales/duplicate-button";
import { AttachmentsDialog } from "@/components/adicionales/attachments-dialog";
import { AuditHistoryDialog } from "@/components/shared/audit-history-dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { PAGE_SIZE_OPTIONS } from "@/lib/additional-services/types";

const STATUS_STYLES: Record<AdditionalServiceStatus, string> = {
  pendiente: "bg-gray-100 text-gray-800 hover:bg-gray-100",
  reportado: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100",
  aprobado: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100",
  rechazado: "bg-red-100 text-red-800 hover:bg-red-100",
  facturado: "bg-blue-100 text-blue-800 hover:bg-blue-100",
};

const STATUS_LABELS: Record<AdditionalServiceStatus, string> = {
  pendiente: "Pendiente",
  reportado: "Reportado",
  aprobado: "Aprobado",
  rechazado: "Rechazado",
  facturado: "Facturado",
};

function StatusBadge({ status }: { status: AdditionalServiceStatus }) {
  return <Badge className={STATUS_STYLES[status]}>{STATUS_LABELS[status]}</Badge>;
}

export function AdditionalServicesTable({
  rows,
  count,
  page,
  pageSize,
  sortColumn,
  sortDirection,
  filters,
  canEdit,
  canDelete,
  canRevert,
  canViewAudit,
  coordinators,
  cenlogs,
  cedis,
  serviceTypes,
  transportTypes,
  chargeDescriptions,
}: {
  rows: AdditionalServiceRow[];
  count: number;
  page: number;
  pageSize: number;
  sortColumn: string;
  sortDirection: "asc" | "desc";
  filters: AdditionalServiceFilters;
  canEdit: boolean;
  canDelete: boolean;
  canRevert: boolean;
  canViewAudit: boolean;
  coordinators: CatalogOption[];
  cenlogs: CatalogOption[];
  cedis: CediOption[];
  serviceTypes: CatalogOption[];
  transportTypes: CatalogOption[];
  chargeDescriptions: CatalogOption[];
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
    const result = await deleteAdditionalService(id);
    if (!result.success) {
      toast.error("No se pudo eliminar", { description: result.message });
      return;
    }
    toast.success("Registro eliminado");
  };

  const handleBulkDelete = async () => {
    const result = await bulkDeleteAdditionalServices(selectedIds);
    if (!result.success) {
      toast.error("No se pudo eliminar", { description: result.message });
      return;
    }
    toast.success(
      `${result.affected} registro${result.affected === 1 ? "" : "s"} eliminado${result.affected === 1 ? "" : "s"}`,
    );
    clearSelection();
  };

  const showActions = canEdit || canDelete || canViewAudit;

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
            {canEdit && (
              <StatusChangeDialog
                trigger={<Button variant="outline" size="sm">Cambiar estado</Button>}
                ids={selectedIds}
                canRevert={canRevert}
                onDone={clearSelection}
              />
            )}
            {canDelete && (
              <ConfirmDialog
                trigger={
                  <Button variant="outline" size="sm" className="text-destructive">
                    Eliminar
                  </Button>
                }
                title="¿Eliminar los registros seleccionados?"
                description={`Se eliminarán ${selected.size} registro(s). Los Facturados no se eliminan.`}
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
              <th className="px-3 py-2.5">Coordinador</th>
              <th className="px-3 py-2.5">CENLOG</th>
              <th className="px-3 py-2.5">Droguería</th>
              <th className="px-3 py-2.5">Ciudad droguería</th>
              <th className="px-3 py-2.5">Tipo de servicio</th>
              <th className="px-3 py-2.5">Cant. recursos</th>
              <th className="px-3 py-2.5">Recurso</th>
              <th className="px-3 py-2.5">
                <SortLink column="service_date" label="Fecha servicio" currentSort={sortColumn} currentDir={sortDirection} />
              </th>
              <th className="px-3 py-2.5">Transporte</th>
              <th className="px-3 py-2.5">Descripción del cobro</th>
              <th className="px-3 py-2.5">Horario</th>
              <th className="px-3 py-2.5">Horas trabajadas</th>
              <th className="px-3 py-2.5">
                <SortLink column="services_count" label="Cant. servicios" currentSort={sortColumn} currentDir={sortDirection} />
              </th>
              <th className="px-3 py-2.5">Soporte de entregas</th>
              <th className="px-3 py-2.5">Autorización del cliente</th>
              <th className="px-3 py-2.5">Estado</th>
              <th className="px-3 py-2.5">Registrado por</th>
              {showActions && <th className="px-3 py-2.5 text-right">Acciones</th>}
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.length === 0 && (
              <tr>
                <td colSpan={19} className="px-3 py-10 text-center text-muted-foreground">
                  No se encontraron registros con los filtros aplicados.
                </td>
              </tr>
            )}
            {rows.map((row) => {
              const isFacturado = row.status === "facturado";
              const showResourceIdentity = row.resources_count_range === "1-5";
              return (
                <tr key={row.id} className="hover:bg-muted/30">
                  <td className="px-3 py-2.5">
                    <Checkbox
                      checked={selected.has(row.id)}
                      onCheckedChange={() => toggleOne(row.id)}
                      aria-label={`Seleccionar ${row.resource_name ?? row.id}`}
                    />
                  </td>
                  <td className="px-3 py-2.5">{row.coordinator?.name ?? "—"}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{row.cenlog?.name ?? "—"}</td>
                  <td className="px-3 py-2.5">
                    <ResizableCell value={row.cedi ? `${row.cedi.code} · ${row.cedi.name}` : "—"} defaultWidth={200} />
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">{row.cedi?.city?.name ?? "—"}</td>
                  <td className="px-3 py-2.5">{row.service_type?.name ?? "—"}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">
                    {row.resources_count_range === "1-5" ? "1 a 5" : "6 o más"}
                  </td>
                  <td className="px-3 py-2.5">
                    {showResourceIdentity ? (
                      <div>
                        <ResizableCell value={row.resource_name ?? "—"} />
                        <div className="text-xs text-muted-foreground">
                          {row.resource_document ?? "—"}
                          {row.plate ? ` · ${row.plate}` : ""}
                        </div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">6 o más (agregado)</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">{formatDate(row.service_date)}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{row.transport_type?.name ?? "—"}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">
                    <ResizableCell value={row.charge_description?.name ?? "—"} />
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">
                    {row.start_time ?? "—"}
                    {row.end_time ? ` - ${row.end_time}` : ""}
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">
                    {formatWorkedHours(row.start_time, row.end_time)}
                  </td>
                  <td className="px-3 py-2.5 text-center">{row.services_count}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">
                    <ResizableCell value={row.delivery_support_note ?? "—"} />
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">
                    <ResizableCell value={row.client_authorization_note ?? "—"} />
                  </td>
                  <td className="px-3 py-2.5">
                    {canEdit ? (
                      <StatusChangeDialog
                        trigger={
                          <button type="button" className="cursor-pointer">
                            <StatusBadge status={row.status} />
                          </button>
                        }
                        ids={[row.id]}
                        currentStatus={row.status}
                        canRevert={canRevert}
                      />
                    ) : (
                      <StatusBadge status={row.status} />
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">
                    <div>{row.created_by_profile?.full_name ?? "—"}</div>
                    <div className="text-xs">{formatDateTime(row.created_at)}</div>
                  </td>
                  {showActions && (
                    <td className="px-3 py-2.5">
                      <div className="flex justify-end gap-1">
                        {canEdit && !isFacturado && (
                          <AdditionalServiceEditDialog
                            record={row}
                            coordinators={coordinators}
                            cenlogs={cenlogs}
                            cedis={cedis}
                            serviceTypes={serviceTypes}
                            transportTypes={transportTypes}
                            chargeDescriptions={chargeDescriptions}
                          />
                        )}
                        {canDelete && !isFacturado && (
                          <ConfirmDialog
                            trigger={
                              <Button variant="ghost" size="icon-sm" aria-label="Eliminar">
                                <Trash2 className="size-4 text-destructive" />
                              </Button>
                            }
                            title="¿Eliminar este registro?"
                            description="¿Estás seguro de que deseas eliminar este registro de Adicionales?"
                            confirmLabel="Eliminar"
                            onConfirm={() => handleDelete(row.id)}
                          />
                        )}
                        {canEdit && <DuplicateButton id={row.id} />}
                        <AttachmentsDialog
                          recordId={row.id}
                          recordLabel={row.resource_name ?? formatDate(row.service_date)}
                          canEdit={canEdit && !isFacturado}
                        />
                        {canViewAudit && (
                          <AuditHistoryDialog
                            module="additional_services"
                            recordId={row.id}
                            recordLabel={row.resource_name ?? formatDate(row.service_date)}
                          />
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <PaginationBar page={page} pageSize={pageSize} count={count} pageSizeOptions={PAGE_SIZE_OPTIONS} />
    </div>
  );
}
