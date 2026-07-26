"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, MapPin } from "lucide-react";
import { setUserCities } from "@/app/(app)/configuraciones/users-actions";
import type { CatalogOption } from "@/lib/catalog/queries";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function UserCitiesDialog({
  userId,
  userLabel,
  cities,
  assignedCityIds,
}: {
  userId: string;
  userLabel: string;
  cities: CatalogOption[];
  assignedCityIds: string[];
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set(assignedCityIds));
  const [submitting, setSubmitting] = useState(false);

  const onOpenChange = (value: boolean) => {
    setOpen(value);
    if (value) setSelected(new Set(assignedCityIds));
  };

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSave = async () => {
    setSubmitting(true);
    const result = await setUserCities(userId, Array.from(selected));
    setSubmitting(false);

    if (!result.success) {
      toast.error("No se pudo guardar", { description: result.message });
      return;
    }
    toast.success("Ciudades actualizadas");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={<Button variant="outline" size="sm" className="gap-1.5" />}>
        <MapPin className="size-3.5" />
        Ciudades ({assignedCityIds.length === 0 ? "todas" : assignedCityIds.length})
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Ciudades asignadas</DialogTitle>
          <DialogDescription>{userLabel}</DialogDescription>
        </DialogHeader>

        <p className="text-xs text-muted-foreground">
          Deja todo sin marcar para que vea datos de todas las ciudades. Si marcas una o más, solo verá lo
          de esas ciudades en Recolección, Conciliación, Tipo de Servicio y Adicionales.
        </p>

        <div className="grid grid-cols-2 gap-1.5 rounded-md border p-2">
          {cities.map((c) => (
            <label key={c.id} className="flex items-center gap-1.5 text-sm">
              <Checkbox checked={selected.has(c.id)} onCheckedChange={() => toggle(c.id)} />
              {c.name}
            </label>
          ))}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button type="button" disabled={submitting} onClick={handleSave}>
            {submitting && <Loader2 className="size-4 animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
