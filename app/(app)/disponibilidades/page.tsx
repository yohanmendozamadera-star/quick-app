import { getCurrentUser, can } from "@/lib/permissions";
import { ModulePlaceholder } from "@/components/layout/module-placeholder";

export default async function DisponibilidadesPage() {
  const user = await getCurrentUser();
  const allowed = can(user?.permissions ?? [], "disponibilidades.view");

  if (!allowed) {
    return (
      <ModulePlaceholder
        title="Disponibilidades"
        description="No tienes permiso para ver este módulo."
        denied
      />
    );
  }

  return (
    <ModulePlaceholder
      title="Disponibilidades"
      description="El registro con número de orden seguro se construye en la Fase 7."
    />
  );
}
