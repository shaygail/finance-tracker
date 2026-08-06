"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Receipt,
  FileSpreadsheet,
  Package,
  ScanLine,
  ShoppingBag,
  Target,
  FileText,
  Settings,
  LogOut,
  Upload,
  Plus,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { signOut } from "next-auth/react";
import { BUSINESS } from "@/lib/constants";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/transactions", label: "Transactions", icon: Receipt },
  { href: "/transactions/new", label: "New Transaction", icon: Plus },
  { href: "/import", label: "Import Excel", icon: Upload },
  { href: "/invoices", label: "Invoices", icon: FileText },
  { href: "/inventory/ingredients", label: "Ingredients", icon: Package },
  { href: "/inventory/scan", label: "Scan QR", icon: ScanLine },
  { href: "/products", label: "Products", icon: ShoppingBag },
  { href: "/reports/sales", label: "Sales Report", icon: BarChart3 },
  { href: "/goals", label: "Savings Goals", icon: Target },
  { href: "/reports/gst", label: "GST Report", icon: FileSpreadsheet },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-64 flex-col border-r border-slate-200 bg-slate-900 text-white">
      <div className="border-b border-slate-700 px-6 py-5">
        <h1 className="text-lg font-bold tracking-wide text-emerald-400">{BUSINESS.name}</h1>
        <p className="text-xs text-slate-400">{BUSINESS.tagline}</p>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active =
            pathname === href ||
            (href !== "/dashboard" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-emerald-600 text-white"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-slate-700 p-3">
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
