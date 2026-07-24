"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const recoverySchema = z.object({
  email: z.string().min(1, "El correo es obligatorio").email("Correo inválido"),
});

type RecoveryForm = z.infer<typeof recoverySchema>;

export default function RecuperarPasswordPage() {
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RecoveryForm>({ resolver: zodResolver(recoverySchema) });

  const onSubmit = async ({ email }: RecoveryForm) => {
    setSubmitting(true);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/actualizar-password`,
    });
    setSubmitting(false);

    if (error) {
      toast.error("No fue posible enviar el correo", { description: error.message });
      return;
    }

    setSent(true);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Recuperar contraseña</CardTitle>
        <CardDescription>
          Te enviaremos un enlace para restablecer tu contraseña.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {sent ? (
          <p className="text-sm text-muted-foreground">
            Si el correo existe en el sistema, recibirás un enlace en unos minutos. Revisa también
            la carpeta de spam.
          </p>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="email">Correo electrónico</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="nombre@empresa.com"
                {...register("email")}
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting && <Loader2 className="size-4 animate-spin" />}
              Enviar enlace
            </Button>

            <a href="/login" className="block text-center text-sm text-muted-foreground hover:underline">
              Volver a iniciar sesión
            </a>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
