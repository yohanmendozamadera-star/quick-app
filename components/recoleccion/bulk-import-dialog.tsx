"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, ClipboardPaste, Loader2, XCircle } from "lucide-react";
import { parseBulkCollectionsText, BULK_COLUMN_LABELS, BULK_REQUIRED_LABELS } from "@/lib/collections/bulk-parse";
import { bulkCreateCollections, type BulkImportResult } from "@/app/(app)/recoleccion/actions";
import type { CatalogOption, CediOption } from "@/lib/catalog/queries";
import { formatCurrency } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type Step = "input" | "preview" | "result";

export function BulkImportDialog({
  clients,
  loadTypes,
  cedis,
}: {
  clients: CatalogOption[];
  loadTypes: CatalogOption[];
  cedis: CediOption[];
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("input");
  const [clientId, setClientId] = useState("");
  const [rawText, setRawText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Extract<BulkImportResult, { success: true }> | null>(null);

  const parsedRows = useMemo(
    () => (rawText.trim() ? parseBulkCollectionsText(rawText, loadTypes, cedis) : []),
    [rawText, loadTypes, cedis],
  );

  const validRows = parsedRows.filter((r) => r.errors.length === 0);
  const invalidRows = parsedRows.filter((r) => r.errors.length > 0);
  const validAmount = validRows.reduce((sum, r) => sum + (r.collection_amount ?? 0), 0);

  const reset = () => {
    setStep("input");
    setClientId("");
    setRawText("");
    setResult(null);
  };

  const onOpenChange = (value: boolean) => {
    setOpen(value);
    if (!value) reset();
  };

  const handleLoad = async () => {
    setSubmitting(true);
    const response = await bulkCreateCollections(clientId, rawText);
    setSubmitting(false);

    if (!response.success) {
      toast.error("No se pudo importar", { description: response.message });
      return;
    }

    setResult(response);
    setStep("result");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={<Button variant="outline" className="gap-1.5" />}>
        <ClipboardPaste className="size-4" />
        Agregar recolección masiva
      </DialogTrigger>

      <DialogContent className="flex max-h-[90vh] max-w-3xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Carga masiva de recolecciones</DialogTitle>
          <DialogDescription>
            {step === "input" && "Pega las filas copiadas desde Excel o Google Sheets, separadas por tabulaciones."}
            {step === "preview" && "Revisa qué filas se pueden cargar y cuáles tienen errores."}
            {step === "result" && "Resultado de la importación."}
          </DialogDescription>
        </DialogHeader>

        {step === "input" && (
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto">
            <div className="space-y-1.5">
              <Label htmlFor="bulk-client">Cliente (aplica a todo el lote) *</Label>
              <select
                id="bulk-client"
                className="h-9 w-full rounded-md border bg-transparent px-2 text-sm"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
              >
                <option value="">Selecciona…</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                El texto pegado no trae el cliente corporativo, así que se asigna una sola vez aquí para
                todas las filas.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="bulk-text">Texto pegado</Label>
              <textarea
                id="bulk-text"
                rows={10}
                className="w-full rounded-md border bg-transparent p-2 font-mono text-xs"
                placeholder="Pega aquí las filas copiadas de Excel o Google Sheets…"
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {parsedRows.length} fila{parsedRows.length === 1 ? "" : "s"} detectada
                {parsedRows.length === 1 ? "" : "s"}.
              </p>
            </div>

            <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
              <p className="mb-1 font-medium text-foreground">Columnas esperadas, en este orden:</p>
              <p>{BULK_COLUMN_LABELS.join("  •  ")}</p>
              <p className="mt-1">
                Obligatorias: <span className="font-medium text-foreground">{BULK_REQUIRED_LABELS.join(", ")}</span>.
                Las demás pueden ir vacías.
              </p>
              <p className="mt-1">
                La Ciudad y el Nombre CEDI no se pegan: se calculan solos a partir del Código CEDI contra
                Configuraciones &gt; Droguerías. Si el código no está registrado ahí, regístralo antes de
                cargar el archivo.
              </p>
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="flex flex-1 flex-col gap-3 overflow-hidden">
            <div className="flex flex-wrap gap-2 text-sm">
              <Badge variant="secondary">{parsedRows.length} pegadas</Badge>
              <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                {validRows.length} listas para cargar
              </Badge>
              {invalidRows.length > 0 && (
                <Badge variant="destructive">{invalidRows.length} con errores</Badge>
              )}
              <Badge variant="outline">Recaudo válido: {formatCurrency(validAmount)}</Badge>
            </div>

            <div className="flex-1 overflow-auto rounded-md border">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-background text-left text-muted-foreground">
                  <tr>
                    <th className="px-2 py-1.5">#</th>
                    <th className="px-2 py-1.5">N° servicio</th>
                    <th className="px-2 py-1.5">Ciudad</th>
                    <th className="px-2 py-1.5">CEDI</th>
                    <th className="px-2 py-1.5">Fecha</th>
                    <th className="px-2 py-1.5">Tipo carga</th>
                    <th className="px-2 py-1.5">Conductor</th>
                    <th className="px-2 py-1.5">Recaudo</th>
                    <th className="px-2 py-1.5">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {parsedRows.map((row) => (
                    <tr key={row.rowNumber} className={row.errors.length > 0 ? "bg-destructive/5" : undefined}>
                      <td className="px-2 py-1.5 text-muted-foreground">{row.rowNumber}</td>
                      <td className="px-2 py-1.5 font-medium">{row.service_number || "—"}</td>
                      <td className="px-2 py-1.5">
                        {row.city_input || "—"}
                        {row.cediResolved && <span className="ml-1 text-emerald-700" title="Calculado desde Droguerías">✓</span>}
                      </td>
                      <td className="px-2 py-1.5">{row.cedi_code || "—"}</td>
                      <td className="px-2 py-1.5">{row.service_date_input || "—"}</td>
                      <td className="px-2 py-1.5">{row.load_type_input || "—"}</td>
                      <td className="px-2 py-1.5">{row.driver_name || "—"}</td>
                      <td className="px-2 py-1.5">
                        {row.collection_amount != null ? formatCurrency(row.collection_amount) : "—"}
                      </td>
                      <td className="px-2 py-1.5">
                        {row.errors.length === 0 ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700">
                            <CheckCircle2 className="size-3.5" /> Lista
                          </span>
                        ) : (
                          <span className="inline-flex items-start gap-1 text-destructive" title={row.errors.join("; ")}>
                            <XCircle className="size-3.5 shrink-0 translate-y-0.5" />
                            {row.errors.join("; ")}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {step === "result" && result && (
          <div className="flex flex-1 flex-col gap-3 overflow-y-auto">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Recibidos</p>
                <p className="text-lg font-semibold">{result.summary.total}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Creados</p>
                <p className="text-lg font-semibold text-emerald-700">{result.summary.created}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Duplicados</p>
                <p className="text-lg font-semibold text-amber-700">{result.summary.duplicated}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Con errores</p>
                <p className="text-lg font-semibold text-destructive">{result.summary.rejected}</p>
              </div>
            </div>

            {result.errorRows.length > 0 && (
              <div className="flex-1 overflow-auto rounded-md border">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-background text-left text-muted-foreground">
                    <tr>
                      <th className="px-2 py-1.5">Fila</th>
                      <th className="px-2 py-1.5">Motivo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {result.errorRows.map((row) => (
                      <tr key={row.rowNumber}>
                        <td className="px-2 py-1.5 text-muted-foreground">{row.rowNumber}</td>
                        <td className="px-2 py-1.5 text-destructive">{row.reasons.join("; ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {step === "input" && (
            <Button
              type="button"
              disabled={!clientId || validRows.length === 0}
              onClick={() => setStep("preview")}
            >
              Ver vista previa
            </Button>
          )}

          {step === "preview" && (
            <>
              <Button type="button" variant="outline" onClick={() => setStep("input")}>
                Volver
              </Button>
              <Button type="button" disabled={validRows.length === 0 || submitting} onClick={handleLoad}>
                {submitting && <Loader2 className="size-4 animate-spin" />}
                Cargar {validRows.length} registro{validRows.length === 1 ? "" : "s"}
              </Button>
            </>
          )}

          {step === "result" && (
            <Button type="button" onClick={() => setOpen(false)}>
              Cerrar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
