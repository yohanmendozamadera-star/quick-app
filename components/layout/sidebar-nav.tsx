"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_ITEMS, isNavGroup, type NavChild, type NavGroup } from "@/lib/nav-items";
import { getFiltersForPath } from "@/lib/session-nav-filters";
import type { CatalogOption } from "@/lib/catalog/queries";

function conciliacionChildren(clients: CatalogOption[]): NavGroup[] {
  return clients.map((client) => ({
    label: client.name,
    children: [
      { href: `/conciliacion?client=${client.id}`, label: "Conciliaciones" },
      { href: `/clientes/${client.id}/consolidado`, label: "Consolidado" },
      { href: `/clientes/${client.id}/paz-y-salvos`, label: "Paz y Salvos" },
    ],
  }));
}

function hasActiveDescendant(children: (NavChild | NavGroup)[], pathname: string): boolean {
  return children.some((child) =>
    isNavGroup(child) ? hasActiveDescendant(child.children, pathname) : pathname.startsWith(child.href),
  );
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

  const items = NAV_ITEMS.map((item) =>
    item.href === "/conciliacion" ? { ...item, children: conciliacionChildren(clients) } : item,
  ).filter((item) => permissions.includes(item.permission));

  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    for (const item of items) {
      if (!item.children) continue;
      if (hasActiveDescendant(item.children, pathname)) initial.add(item.href);
      for (const child of item.children) {
        if (isNavGroup(child) && hasActiveDescendant(child.children, pathname)) {
          initial.add(`${item.href}|${child.label}`);
        }
      }
    }
    return initial;
  });

  const toggle = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Si ya visitaste este módulo en esta sesión, se restauran los filtros que
  // dejaste (en vez de siempre abrir la vista limpia).
  const navLinkClick = (href: string) => (e: React.MouseEvent) => {
    const savedQuery = getFiltersForPath(href);
    if (savedQuery) {
      e.preventDefault();
      router.push(`${href}?${savedQuery}`);
    }
    onNavigate?.();
  };

  return (
    <nav className="flex flex-col gap-1 p-2">
      {items.map((item) => {
        const Icon = item.icon;

        if (item.children && item.children.length > 0) {
          const isExpanded = expanded.has(item.href);
          const ownActive = pathname.startsWith(item.href);
          const active = ownActive || hasActiveDescendant(item.children, pathname);
          return (
            <div key={item.href}>
              <div
                className={cn(
                  "flex items-center gap-1 rounded-md text-sm font-medium transition-colors",
                  ownActive
                    ? "bg-primary text-primary-foreground"
                    : active
                      ? "text-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Link
                  href={item.href}
                  onClick={navLinkClick(item.href)}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    "flex flex-1 items-center gap-3 px-3 py-2",
                    collapsed && "justify-center px-2",
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  {!collapsed && <span>{item.label}</span>}
                </Link>
                {!collapsed && (
                  <button
                    type="button"
                    onClick={() => toggle(item.href)}
                    aria-label={isExpanded ? "Contraer" : "Expandir"}
                    className={cn(
                      "rounded-md p-2",
                      !ownActive && "hover:bg-muted hover:text-foreground",
                    )}
                  >
                    {isExpanded ? (
                      <ChevronDown className="size-4 shrink-0" />
                    ) : (
                      <ChevronRight className="size-4 shrink-0" />
                    )}
                  </button>
                )}
              </div>
              {!collapsed && isExpanded && (
                <div className="ml-4 flex flex-col gap-1 border-l pl-3">
                  {item.children.map((child) => {
                    if (isNavGroup(child)) {
                      const groupKey = `${item.href}|${child.label}`;
                      const groupExpanded = expanded.has(groupKey);
                      const groupActive = hasActiveDescendant(child.children, pathname);
                      return (
                        <div key={child.label}>
                          <button
                            type="button"
                            onClick={() => toggle(groupKey)}
                            className={cn(
                              "flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                              groupActive
                                ? "text-foreground"
                                : "text-muted-foreground hover:bg-muted hover:text-foreground",
                            )}
                          >
                            <span className="flex-1 text-left">{child.label}</span>
                            {groupExpanded ? (
                              <ChevronDown className="size-4 shrink-0" />
                            ) : (
                              <ChevronRight className="size-4 shrink-0" />
                            )}
                          </button>
                          {groupExpanded && (
                            <div className="ml-3 flex flex-col gap-1 border-l pl-3">
                              {child.children.map((grandchild) => {
                                const grandchildActive = pathname.startsWith(grandchild.href);
                                return (
                                  <Link
                                    key={grandchild.href}
                                    href={grandchild.href}
                                    onClick={navLinkClick(grandchild.href)}
                                    className={cn(
                                      "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                                      grandchildActive
                                        ? "bg-primary text-primary-foreground"
                                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                                    )}
                                  >
                                    {grandchild.label}
                                  </Link>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    }

                    const childActive = pathname.startsWith(child.href);
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        onClick={navLinkClick(child.href)}
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
            onClick={navLinkClick(item.href)}
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
