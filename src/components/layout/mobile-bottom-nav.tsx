"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Receipt,
  ScanLine,
  Package,
  Menu,
} from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard, match: (p: string) => p === "/dashboard" },
  {
    href: "/transactions",
    label: "Spend",
    icon: Receipt,
    match: (p: string) => p.startsWith("/transactions"),
  },
  {
    href: "/inventory/scan",
    label: "Scan",
    icon: ScanLine,
    match: (p: string) => p.startsWith("/inventory/scan"),
  },
  {
    href: "/inventory/ingredients",
    label: "Stock",
    icon: Package,
    match: (p: string) => p.startsWith("/inventory/ingredients"),
  },
];

interface MobileBottomNavProps {
  onMore: () => void;
}

export function MobileBottomNav({ onMore }: MobileBottomNavProps) {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 lg:hidden pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto grid max-w-lg grid-cols-5">
        {tabs.map(({ href, label, icon: Icon, match }) => {
          const active = match(pathname);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-medium",
                active ? "text-emerald-600" : "text-slate-500"
              )}
            >
              <Icon className={cn("h-5 w-5", active && "stroke-[2.25]")} />
              {label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={onMore}
          className="flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-medium text-slate-500"
        >
          <Menu className="h-5 w-5" />
          More
        </button>
      </div>
    </nav>
  );
}
