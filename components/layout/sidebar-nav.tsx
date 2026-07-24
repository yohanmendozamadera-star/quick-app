"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "@/lib/nav-items";
import { getFiltersForPath } from "@/lib/session-nav-filters";

export function SidebarNav({
  permissions,
  collapsed = false,
  onNavigate,
}: {
  permissions: string[];
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <nav className="flex flex-col gap-1 p-2">
      {NAV_ITEMS.filter((item) => permissions.includes(item.permission)).map((item) => {
        const active = pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={(e) => {
              // Si ya visitaste este módulo en esta sesión, se restauran los
              // filtros que dejaste (en vez de siempre abrir la vista limpia).
              const savedQuery = getFiltersForPath(item.href);
              if (savedQuery) {
                e.preventDefault();
                router.push(`${item.href}?${savedQuery}`);
              }
              onNavigate?.();
            }}
            title={collapsed ? item.label : undefined}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
              collapsed && "justify-center px-2",
            )}
          >
            <Icon className="size-4 shrink-0" />
            {!collapsed && <span>{item.label}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
