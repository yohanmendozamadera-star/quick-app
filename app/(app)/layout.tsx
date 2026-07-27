import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { getClients } from "@/lib/catalog/queries";
import { AppShell } from "@/components/layout/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  if (!user) {
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect("/login");
  }

  const clients = await getClients();

  return (
    <AppShell
      fullName={user.fullName}
      roleName={user.roleName}
      email={user.email}
      avatarUrl={user.avatarUrl}
      permissions={user.permissions}
      clients={clients}
    >
      {children}
    </AppShell>
  );
}
