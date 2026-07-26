import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/permissions";
import { ProfileForm } from "@/components/mi-perfil/profile-form";

export default async function MiPerfilPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <ProfileForm
      fullName={user.fullName}
      email={user.email}
      roleName={user.roleName}
      avatarUrl={user.avatarUrl}
    />
  );
}
