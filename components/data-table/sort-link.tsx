"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";

export function SortLink({
  column,
  label,
  currentSort,
  currentDir,
}: {
  column: string;
  label: string;
  currentSort: string;
  currentDir: "asc" | "desc";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const active = currentSort === column;

  const handleClick = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("sort", column);
    params.set("dir", active && currentDir === "asc" ? "desc" : "asc");
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="inline-flex items-center gap-1 font-medium hover:text-foreground"
    >
      {label}
      {active ? (
        currentDir === "asc" ? (
          <ArrowUp className="size-3.5" />
        ) : (
          <ArrowDown className="size-3.5" />
        )
      ) : (
        <ArrowUpDown className="size-3.5 opacity-40" />
      )}
    </button>
  );
}
