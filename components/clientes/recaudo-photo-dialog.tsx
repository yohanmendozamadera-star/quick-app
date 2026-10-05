"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, Loader2, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { saveRecaudoPhoto, getRecaudoPhotoUrl } from "@/app/(app)/clientes/[clientId]/recaudos/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { formatDate } from "@/lib/format";
import type { RecaudoRow } from "@/lib/recaudos/types";

export function RecaudoPhotoDialog({ clientId, row, canUpload }: { clientId: string; row: RecaudoRow; canUpload: boolean }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  async function upload() {
    const file = input.current?.files?.[0];
    if (!file || !["image/jpeg","image/png","image/webp"].includes(file.type) || file.size === 0 || file.size > 10*1024*1024) {
      toast.error("Selecciona una foto JPG, PNG o WebP de hasta 10 MB."); return;
    }
    const extension = file.type === "image/jpeg" ? "jpg" : file.type === "image/png" ? "png" : "webp";
    const path = `${clientId}/${row.cityId}/${row.date}/${crypto.randomUUID()}.${extension}`;
    const supabase = createClient();
    setBusy(true);
    try {
      const { error } = await supabase.storage.from("recaudos").upload(path,file,{ contentType:file.type, upsert:false });
      if (error) throw new Error("No se pudo cargar la foto. Revisa tu conexión y vuelve a intentar.");
      const result = await saveRecaudoPhoto({ clientId, cityId:row.cityId, date:row.date,
        cediName:row.cediName, storagePath:path, fileName:file.name });
      if (!result.success) {
        await supabase.storage.from("recaudos").remove([path]);
        throw new Error(result.message);
      }
      toast.success("Foto de consignación guardada");
      setOpen(false); router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar la foto.");
    } finally { setBusy(false); }
  }
  async function viewPhoto() {
    if (!row.document) return;
    // Abrir durante el clic evita que el navegador bloquee la nueva pestaña.
    const tab = window.open("about:blank","_blank");
    if (tab) tab.opener = null;
    try {
      const url = await getRecaudoPhotoUrl(row.document.id);
      if (!url) throw new Error("No se pudo abrir la consignación.");
      if (tab) tab.location.href = url;
      else window.location.assign(url);
    } catch { tab?.close(); toast.error("No se pudo abrir la consignación."); }
  }
  return <div className="flex flex-wrap items-center gap-2">
    {row.document && <Button variant="outline" size="sm" onClick={viewPhoto} title={row.document.fileName}>
      <ImageIcon className="size-4" /> Ver foto
    </Button>}
    {canUpload && row.cityId && row.cediName && <Dialog open={open} onOpenChange={value => { if (!busy) setOpen(value); }}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Upload className="size-4" /> {row.document ? "Cambiar foto" : "Cargar foto"}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Foto de consignación</DialogTitle>
          <DialogDescription>{row.cediName} · {row.cityName} · {formatDate(row.date)}</DialogDescription>
        </DialogHeader>
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} aria-label="Foto de consignación" className="w-full text-sm" />
        <p className="text-xs text-muted-foreground">JPG, PNG o WebP. Máximo 10 MB.{row.document ? " La nueva foto reemplazará la anterior." : ""}</p>
        <DialogFooter><Button onClick={upload} disabled={busy}>{busy && <Loader2 className="size-4 animate-spin" />} Guardar foto</Button></DialogFooter>
      </DialogContent>
    </Dialog>}
    {!row.document && (!canUpload || !row.cityId || !row.cediName) && <span className="text-xs text-muted-foreground">Sin foto</span>}
  </div>;
}
