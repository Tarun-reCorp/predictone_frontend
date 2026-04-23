"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, TrendingUp, Settings,
  ChevronRight, Bell, CircleDot,
  LogOut, ShoppingBag, ArrowUpDown,
  ArrowUpCircle, ArrowDownCircle, Wallet,
  CreditCard, HandCoins, Store,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";

const NAV_ITEMS = [
  { label: "Overview",          href: "/admin",                     icon: LayoutDashboard },
  { label: "Orders",            href: "/admin/orders",              icon: ShoppingBag     },
  { label: "Transactions",      href: "/admin/transactions",        icon: ArrowUpDown     },
  { label: "Fund Requests",     href: "/admin/fund-requests",       icon: ArrowUpCircle   },
  { label: "Withdraw Requests", href: "/admin/withdraw-requests",   icon: ArrowDownCircle },
  { label: "Topup",             href: "/admin/topup",               icon: HandCoins       },
  { label: "Wallet",            href: "/admin/wallet",              icon: Wallet          },
  { label: "Markets",           href: "/admin/markets",             icon: TrendingUp      },
  { label: "Merchants",         href: "/admin/merchants",           icon: CreditCard      },
  { label: "Settings",          href: "/admin/settings",            icon: Settings        },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router   = useRouter();
  const { user, loading, logout } = useAuth();

  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace("/");
    if (!loading && user && user.role !== "admin") router.replace("/merchant");
  }, [user, loading, router]);

  if (loading || !user || user.role !== "admin") return null;

  const initials = user.name.split(" ").slice(0, 2).map((w) => w[0].toUpperCase()).join("");

  const activeItem = NAV_ITEMS.find((item) =>
    item.href === "/admin"
      ? pathname === "/admin"
      : pathname.startsWith(item.href)
  );
  const breadcrumb = activeItem?.label ?? "Admin";

  return (
    <div className="flex min-h-screen bg-background">
      {/* ── Sidebar ── */}
      <aside className={cn(
        "flex flex-col border-r border-border bg-[oklch(0.13_0.005_240)] transition-all duration-200 shrink-0",
        collapsed ? "w-14" : "w-56"
      )}>
        {/* Header */}
        <div className="flex h-14 items-center justify-between px-3 border-b border-border">
          {!collapsed && (
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-brand">
                <TrendingUp className="h-3.5 w-3.5 text-white" />
              </div>
              <div className="leading-tight">
                <p className="text-xs font-bold text-foreground tracking-tight">
                  Predict<span className="text-brand">One</span>
                </p>
                <p className="text-[10px] text-muted-foreground font-medium tracking-wider uppercase">Admin</p>
              </div>
            </Link>
          )}
          {collapsed && (
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-brand mx-auto">
              <TrendingUp className="h-3.5 w-3.5 text-white" />
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={cn(
              "flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors",
              collapsed && "mx-auto mt-2"
            )}
          >
            <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", collapsed ? "" : "rotate-180")} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-0.5 p-2 flex-1">
          {NAV_ITEMS.map((item) => {
            const isActive = item.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                className={cn(
                  "flex items-center gap-3 rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-brand/15 text-brand"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span>{item.label}</span>}
                {!collapsed && isActive && (
                  <span className="ml-auto h-1.5 w-1.5 rounded-full bg-brand" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* User footer */}
        <div className="p-2 border-t border-border">
          {!collapsed ? (
            <div className="flex items-center gap-2 rounded-md px-2.5 py-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-brand text-primary-foreground text-[10px] font-bold shrink-0">
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground truncate">{user.name}</p>
                <p className="text-[10px] text-muted-foreground truncate">{user.email}</p>
              </div>
              <button
                onClick={() => { logout(); router.replace("/"); }}
                title="Log Out"
                className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-secondary transition-colors shrink-0"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => { logout(); router.replace("/"); }}
              className="flex w-full items-center justify-center p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-secondary transition-colors"
              title="Log Out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="flex flex-col flex-1 min-w-0">
        <header className="flex h-14 items-center justify-between border-b border-border px-6 bg-background/80 backdrop-blur-sm sticky top-0 z-40">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link href="/" className="hover:text-foreground transition-colors">PredictOne</Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-foreground font-medium">{breadcrumb}</span>
          </div>
          <div className="flex items-center gap-3">
            {/* Markets home button */}
            <Link
              href="/"
              className="flex items-center gap-1.5 rounded-lg border border-border bg-secondary/50 hover:bg-secondary px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <Store className="h-3.5 w-3.5" />
              <span>Markets</span>
            </Link>

            <div className="flex items-center gap-1.5 rounded-md border border-yes/30 bg-yes/10 px-2.5 py-1">
              <CircleDot className="h-3 w-3 text-yes" />
              <span className="text-xs font-medium text-yes">Live</span>
            </div>
            <button className="relative flex h-8 w-8 items-center justify-center rounded-md border border-border hover:bg-secondary transition-colors">
              <Bell className="h-4 w-4 text-muted-foreground" />
            </button>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-primary-foreground text-xs font-bold">
              {initials}
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
