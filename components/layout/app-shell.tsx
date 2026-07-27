"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Header } from "@/components/layout/header";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { CatalogOption } from "@/lib/catalog/queries";

export function AppShell({
  fullName,
  roleName,
  email,
  avatarUrl,
  permissions,
  clients,
  children,
}: {
  fullName: string;
  roleName: string;
  email: string;
  avatarUrl: string | null;
  permissions: string[];
  clients: CatalogOption[];
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-muted/30">
      <aside
        className={cn(
          "hidden shrink-0 border-r bg-background transition-[width] duration-200 md:flex md:flex-col",
          collapsed ? "w-16" : "w-64",
        )}
      >
        <div className="flex h-14 items-center justify-center border-b px-3 font-semibold tracking-tight">
          {collapsed ? "Q" : "Quick"}
        </div>
        <SidebarNav permissions={permissions} clients={clients} collapsed={collapsed} />
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-64 p-0">
          <SheetHeader className="border-b">
            <SheetTitle>Quick</SheetTitle>
          </SheetHeader>
          <SidebarNav
            permissions={permissions}
            clients={clients}
            onNavigate={() => setMobileOpen(false)}
          />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header
          fullName={fullName}
          roleName={roleName}
          email={email}
          avatarUrl={avatarUrl}
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((value) => !value)}
          onOpenMobileMenu={() => setMobileOpen(true)}
        />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
