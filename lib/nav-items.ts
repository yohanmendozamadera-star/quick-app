import {
  LayoutDashboard,
  Activity,
  PackageSearch,
  Truck,
  PlusCircle,
  ClipboardCheck,
  CalendarClock,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type NavChild = {
  href: string;
  label: string;
};

/** Grupo intermedio dentro de un NavItem: un toggle (sin href propio) cuyos hijos son links. */
export type NavGroup = {
  label: string;
  children: NavChild[];
};

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  permission: string;
  children?: (NavChild | NavGroup)[];
};

export function isNavGroup(child: NavChild | NavGroup): child is NavGroup {
  return !("href" in child);
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, permission: "dashboard.view" },
  { href: "/operacion", label: "Operación", icon: Activity, permission: "dashboard.view" },
  { href: "/recoleccion", label: "Recolección", icon: PackageSearch, permission: "recoleccion.view" },
  { href: "/tipo-servicio", label: "Tipo de Servicio", icon: Truck, permission: "tipo_servicio.view" },
  { href: "/adicionales", label: "Adicionales", icon: PlusCircle, permission: "adicionales.view" },
  { href: "/conciliacion", label: "Conciliación", icon: ClipboardCheck, permission: "conciliacion.view" },
  { href: "/disponibilidades", label: "Disponibilidades", icon: CalendarClock, permission: "disponibilidades.view" },
  { href: "/configuraciones", label: "Configuraciones", icon: Settings, permission: "config.manage" },
];
