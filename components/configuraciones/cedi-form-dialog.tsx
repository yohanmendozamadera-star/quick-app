"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Pencil, Plus } from "lucide-react";
import { createCedi, updateCedi } from "@/app/(app)/configuraciones/actions";
import type { CediOption, CatalogOption } from "@/lib/catalog/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function CediFormDialog({ cedi, cities }: { cedi?: CediOption; cities: CatalogOption[] }) {
  const isEdit = Boolean(cedi);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [code, setCode] = useState(cedi?.code ?? "");
  const [name, setName] = useState(cedi?.name ?? "");
  const [cityId, setCityId] = useState(cedi?.city_id ?? "");

  const onOpenChange = (value: boolean) => {
    setOpen(value);
    if (value) {
      setCode(cedi?.code ?? "");
      setName(cedi?.name ?? "");
      setCityId(cedi?.city_id ?? "");
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    const result = isEdit
      ? await updateCedi(cedi!.id, { code, name, city_id: cityId })
      : await createCedi({ code, name, city_id: cityId });
    setSubmitting(false);

    if (!result.success) {
      toast.error("No se pudo guardar", { description: result.message });
      return;
    }

    toast.success(isEdit ? "Droguería actualizada" : "Droguería creada");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger
        render={
          isEdit ? (
            <Button variant="ghost" size="icon-sm" aria-label="Editar" />
          ) : (
            <Button className="gap-1.5" />
          )
        }
      >
        {isEdit ? <Pencil className="size-4" /> : (
          <>
            <Plus className="size-4" />
            Agregar droguería
          </>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar droguería" : "Nueva droguería"}</DialogTitle>
          <DialogDescription>
            El código debe ser único (ej. D828) y sirve para calcular automáticamente la ciudad en
            Recolección y Adicionales.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="cedi_code">Código *</Label>
            <Input id="cedi_code" value={code} onChange={(e) => setCode(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cedi_city">Ciudad *</Label>
            <select
              id="cedi_city"
              className="h-9 w-full rounded-md border bg-transparent px-2 text-sm"
              value={cityId}
              onChange={(e) => setCityId(e.target.value)}
            >
              <option value="">Selecciona…</option>
              {cities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cedi_name">Nombre de la droguería *</Label>
            <Input id="cedi_name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            disabled={submitting || !code.trim() || !name.trim() || !cityId}
            onClick={handleSubmit}
          >
            {submitting && <Loader2 className="size-4 animate-spin" />}
            {isEdit ? "Guardar cambios" : "Crear droguería"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
