"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Menu, PanelLeftClose, PanelLeftOpen, LogOut, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { clearAllSavedFilters } from "@/lib/session-nav-filters";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function Header({
  fullName,
  roleName,
  avatarUrl,
  collapsed,
  onToggleCollapse,
  onOpenMobileMenu,
}: {
  fullName: string;
  roleName: string;
  email: string;
  avatarUrl: string | null;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onOpenMobileMenu: () => void;
}) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    clearAllSavedFilters();
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  };

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b bg-background px-3 md:px-4">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={onOpenMobileMenu}
          aria-label="Abrir menú"
        >
          <Menu className="size-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="hidden md:inline-flex"
          onClick={onToggleCollapse}
          aria-label="Contraer u expandir menú"
        >
          {collapsed ? <PanelLeftOpen className="size-5" /> : <PanelLeftClose className="size-5" />}
        </Button>
        <span className="font-semibold tracking-tight">Quick</span>
      </div>

      <div className="flex items-center gap-3">
        <Link href="/mi-perfil" className="flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-muted" title="Mi perfil">
          <Avatar className="size-7">
            {avatarUrl && <AvatarImage src={avatarUrl} alt={fullName} />}
            <AvatarFallback className="text-xs">{initials(fullName) || "U"}</AvatarFallback>
          </Avatar>
          <span className="hidden text-sm font-medium sm:inline">{fullName}</span>
          <Badge variant="secondary" className="hidden sm:inline-flex">
            {roleName}
          </Badge>
        </Link>

        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="outline"
                size="sm"
                onClick={handleSignOut}
                disabled={signingOut}
                aria-label="Cerrar sesión"
              />
            }
          >
            {signingOut ? <Loader2 className="size-4 animate-spin" /> : <LogOut className="size-4" />}
            <span className="hidden sm:inline">Cerrar sesión</span>
          </TooltipTrigger>
          <TooltipContent>Cerrar sesión</TooltipContent>
        </Tooltip>
      </div>
    </header>
  );
}
