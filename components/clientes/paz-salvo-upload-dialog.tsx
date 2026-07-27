"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Upload } from "lucide-react";
import {
  uploadPazSalvoDocument,
} from "@/app/(app)/clientes/[clientId]/paz-y-salvos/actions";
import type { PazSalvoDocumentType } from "@/lib/paz-salvo/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function PazSalvoUploadDialog({
  clientId,
  cityId,
  cediCode,
  cediName,
  period,
  documentType,
}: {
  clientId: string;
  cityId: string;
  cediCode: string;
  cediName: string | null;
  period: string;
  documentType: PazSalvoDocumentType;
}) {
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      toast.error("Selecciona un archivo primero");
      return;
    }
    const formData = new FormData();
    formData.set("file", file);

    setUploading(true);
    const result = await uploadPazSalvoDocument(
      clientId,
      cityId,
      cediCode,
      cediName,
      period,
      documentType,
      formData,
    );
    setUploading(false);

    if (!result.success) {
      toast.error("No se pudo adjuntar el documento", { description: result.message });
      return;
    }

    toast.success("Documento firmado adjuntado");
    if (fileInputRef.current) fileInputRef.current.value = "";
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Adjuntar firmado" />}>
        <Upload className="size-4" />
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Adjuntar documento firmado</DialogTitle>
          <DialogDescription>
            {cediName ?? cediCode} ({cediCode})
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <input ref={fileInputRef} type="file" accept="application/pdf" className="w-full text-sm" />
          <p className="text-xs text-muted-foreground">Solo PDF. Máximo 10 MB.</p>
        </div>

        <DialogFooter>
          <Button type="button" disabled={uploading} onClick={handleUpload} className="gap-1.5">
            {uploading && <Loader2 className="size-3.5 animate-spin" />}
            Adjuntar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
