"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, ClipboardPaste, Loader2, XCircle } from "lucide-react";
import { parseCedisBulkText, CEDIS_BULK_COLUMN_LABELS } from "@/lib/config/cedis-bulk-parse";
import { bulkImportCedis, type BulkImportResult } from "@/app/(app)/configuraciones/actions";
import type { CatalogOption } from "@/lib/catalog/queries";
import { Button } from "@/components/ui/button";
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

export function CedisBulkImportDialog({ cities }: { cities: CatalogOption[] }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("input");
  const [rawText, setRawText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Extract<BulkImportResult, { success: true }> | null>(null);

  const parsedRows = useMemo(
    () => (rawText.trim() ? parseCedisBulkText(rawText, cities) : []),
    [rawText, cities],
  );

  const validRows = parsedRows.filter((r) => r.errors.length === 0);
  const invalidRows = parsedRows.filter((r) => r.errors.length > 0);

  const reset = () => {
    setStep("input");
    setRawText("");
    setResult(null);
  };

  const onOpenChange = (value: boolean) => {
    setOpen(value);
    if (!value) reset();
  };

  const handleLoad = async () => {
    setSubmitting(true);
    const response = await bulkImportCedis(rawText);
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
        Carga masiva de droguerías
      </DialogTrigger>

      <DialogContent className="flex max-h-[90vh] max-w-3xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Carga masiva de droguerías</DialogTitle>
          <DialogDescription>
            {step === "input" && "Pega las filas copiadas desde Excel, separadas por tabulaciones."}
            {step === "preview" && "Revisa qué filas se pueden cargar y cuáles tienen errores."}
            {step === "result" && "Resultado de la importación."}
          </DialogDescription>
        </DialogHeader>

        {step === "input" && (
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto">
            <div className="space-y-1.5">
              <textarea
                rows={10}
                className="w-full rounded-md border bg-transparent p-2 font-mono text-xs"
                placeholder="CODIGO	CIUDAD	CEDI&#10;D385	BARRANQUILLA	Colsubsidio Drog. Portoazul - B/quilla…"
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
              <p>{CEDIS_BULK_COLUMN_LABELS.join("  •  ")}</p>
              <p className="mt-1">
                Si el código ya existe, se actualiza el nombre y la ciudad. La ciudad debe coincidir con
                una ya registrada.
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
            </div>

            <div className="flex-1 overflow-auto rounded-md border">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-background text-left text-muted-foreground">
                  <tr>
                    <th className="px-2 py-1.5">#</th>
                    <th className="px-2 py-1.5">Código</th>
                    <th className="px-2 py-1.5">Ciudad</th>
                    <th className="px-2 py-1.5">Droguería</th>
                    <th className="px-2 py-1.5">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {parsedRows.map((row) => (
                    <tr key={row.rowNumber} className={row.errors.length > 0 ? "bg-destructive/5" : undefined}>
                      <td className="px-2 py-1.5 text-muted-foreground">{row.rowNumber}</td>
                      <td className="px-2 py-1.5 font-medium">{row.code || "—"}</td>
                      <td className="px-2 py-1.5">{row.city_input || "—"}</td>
                      <td className="px-2 py-1.5">{row.name || "—"}</td>
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
                <p className="text-xs text-muted-foreground">Actualizados</p>
                <p className="text-lg font-semibold text-blue-700">{result.summary.updated}</p>
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
            <Button type="button" disabled={validRows.length === 0} onClick={() => setStep("preview")}>
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
