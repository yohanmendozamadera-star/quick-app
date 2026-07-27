"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Building2, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_ITEMS, type NavItem } from "@/lib/nav-items";
import { getFiltersForPath } from "@/lib/session-nav-filters";
import type { CatalogOption } from "@/lib/catalog/queries";

function clientToNavItem(client: CatalogOption): NavItem {
  return {
    href: `/clientes/${client.id}`,
    label: client.name,
    icon: Building2,
    permission: "conciliacion.view",
    children: [
      { href: `/clientes/${client.id}/consolidado`, label: "Consolidado" },
      { href: `/clientes/${client.id}/paz-y-salvos`, label: "Paz y Salvos" },
    ],
  };
}

export function SidebarNav({
  permissions,
  clients,
  collapsed = false,
  onNavigate,
}: {
  permissions: string[];
  clients: CatalogOption[];
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const items = [...NAV_ITEMS, ...clients.map(clientToNavItem)].filter((item) =>
    permissions.includes(item.permission),
  );

  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    for (const item of items) {
      if (item.children?.some((child) => pathname.startsWith(child.href))) {
        initial.add(item.href);
      }
    }
    return initial;
  });

  const toggle = (href: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(href)) next.delete(href);
      else next.add(href);
      return next;
    });
  };

  return (
    <nav className="flex flex-col gap-1 p-2">
      {items.map((item) => {
        const Icon = item.icon;

        if (item.children && item.children.length > 0) {
          const isExpanded = expanded.has(item.href);
          const active = item.children.some((child) => pathname.startsWith(child.href));
          return (
            <div key={item.href}>
              <button
                type="button"
                onClick={() => toggle(item.href)}
                title={collapsed ? item.label : undefined}
                className={cn(
                  "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "text-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  collapsed && "justify-center px-2",
                )}
              >
                <Icon className="size-4 shrink-0" />
                {!collapsed && (
                  <>
                    <span className="flex-1 text-left">{item.label}</span>
                    {isExpanded ? (
                      <ChevronDown className="size-4 shrink-0" />
                    ) : (
                      <ChevronRight className="size-4 shrink-0" />
                    )}
                  </>
                )}
              </button>
              {!collapsed && isExpanded && (
                <div className="ml-4 flex flex-col gap-1 border-l pl-3">
                  {item.children.map((child) => {
                    const childActive = pathname.startsWith(child.href);
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        onClick={(e) => {
                          const savedQuery = getFiltersForPath(child.href);
                          if (savedQuery) {
                            e.preventDefault();
                            router.push(`${child.href}?${savedQuery}`);
                          }
                          onNavigate?.();
                        }}
                        className={cn(
                          "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                          childActive
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground",
                        )}
                      >
                        {child.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        }

        const active = pathname.startsWith(item.href);
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
