"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Camera, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { updateMyProfile, uploadMyAvatar } from "@/app/(app)/mi-perfil/actions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

const passwordSchema = z
  .object({
    password: z.string().min(8, "Mínimo 8 caracteres"),
    confirmPassword: z.string().min(1, "Confirma la contraseña"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  });

type PasswordForm = z.infer<typeof passwordSchema>;

export function ProfileForm({
  fullName: initialFullName,
  email,
  roleName,
  avatarUrl: initialAvatarUrl,
}: {
  fullName: string;
  email: string;
  roleName: string;
  avatarUrl: string | null;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState(initialFullName);
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);
  const [savingName, setSavingName] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const {
    register: registerPassword,
    handleSubmit: handlePasswordSubmit,
    reset: resetPasswordForm,
    formState: { errors: passwordErrors },
  } = useForm<PasswordForm>({ resolver: zodResolver(passwordSchema) });
  const [savingPassword, setSavingPassword] = useState(false);

  const handleAvatarClick = () => fileInputRef.current?.click();

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.set("file", file);

    setUploadingAvatar(true);
    const result = await uploadMyAvatar(formData);
    setUploadingAvatar(false);
    e.target.value = "";

    if (!result.success) {
      toast.error("No se pudo subir la foto", { description: result.message });
      return;
    }

    setAvatarUrl(result.avatarUrl);
    toast.success("Foto de perfil actualizada");
    router.refresh();
  };

  const handleSaveName = async () => {
    setSavingName(true);
    const result = await updateMyProfile(fullName);
    setSavingName(false);

    if (!result.success) {
      toast.error("No se pudo guardar", { description: result.message });
      return;
    }

    toast.success("Nombre actualizado");
    router.refresh();
  };

  const onSubmitPassword = async ({ password }: PasswordForm) => {
    setSavingPassword(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setSavingPassword(false);

    if (error) {
      toast.error("No fue posible actualizar la contraseña", { description: error.message });
      return;
    }

    toast.success("Contraseña actualizada");
    resetPasswordForm();
  };

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Mi perfil</CardTitle>
          <CardDescription>Tu información de cuenta y foto de perfil.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Avatar size="lg" className="size-16">
                {avatarUrl && <AvatarImage src={avatarUrl} alt={fullName} />}
                <AvatarFallback className="text-lg">{initials(fullName) || "U"}</AvatarFallback>
              </Avatar>
              <button
                type="button"
                onClick={handleAvatarClick}
                disabled={uploadingAvatar}
                aria-label="Cambiar foto de perfil"
                className="absolute -right-1 -bottom-1 flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow"
              >
                {uploadingAvatar ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Camera className="size-3.5" />
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={handleAvatarChange}
              />
            </div>
            <div>
              <p className="font-medium">{fullName}</p>
              <p className="text-sm text-muted-foreground">{email}</p>
              <Badge variant="secondary" className="mt-1">
                {roleName}
              </Badge>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">PNG, JPG o WEBP. Máximo 3 MB.</p>

          <Separator />

          <div className="space-y-1.5">
            <Label htmlFor="full_name">Nombre completo</Label>
            <div className="flex gap-2">
              <Input id="full_name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
              <Button type="button" disabled={savingName || !fullName.trim()} onClick={handleSaveName}>
                {savingName && <Loader2 className="size-4 animate-spin" />}
                Guardar
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Correo</Label>
            <Input value={email} disabled />
            <p className="text-xs text-muted-foreground">
              El correo no se puede cambiar desde aquí. Pide a un Administrador que lo actualice.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Cambiar contraseña</CardTitle>
          <CardDescription>Define una nueva contraseña para tu cuenta.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordSubmit(onSubmitPassword)} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="password">Nueva contraseña</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                {...registerPassword("password")}
              />
              {passwordErrors.password && (
                <p className="text-sm text-destructive">{passwordErrors.password.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
              <Input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                {...registerPassword("confirmPassword")}
              />
              {passwordErrors.confirmPassword && (
                <p className="text-sm text-destructive">{passwordErrors.confirmPassword.message}</p>
              )}
            </div>

            <Button type="submit" disabled={savingPassword}>
              {savingPassword && <Loader2 className="size-4 animate-spin" />}
              Actualizar contraseña
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
