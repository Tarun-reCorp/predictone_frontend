"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, TrendingUp, BarChart2, Settings,
  ChevronRight, Bell, CircleDot, Users,
  LogOut, ChevronDown, ShoppingBag, ArrowUpDown,
  Receipt, ArrowUpCircle, Wallet, CheckCircle2, AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import { useWalletContext } from "@/contexts/wallet-context";
import { AdminWalletConnect } from "@/components/admin-wallet-connect";

const NAV_ITEMS = [
  { label: "Overview",      href: "/admin",                icon: LayoutDashboard },
  { label: "Merchants",     href: "/admin/merchants",      icon: Users           },
  { label: "Commission",    href: "/admin/commission",     icon: Receipt         },
  { label: "Fund Requests", href: "/admin/fund-requests",  icon: ArrowUpCircle   },
  { label: "Markets",       href: "/admin/markets",        icon: TrendingUp      },
  { label: "Trades",        href: "/admin/trades",         icon: BarChart2       },
  { label: "Orders",        href: "/admin/orders",         icon: ShoppingBag     },
  { label: "Transactions",  href: "/admin/transactions",   icon: ArrowUpDown     },
  { label: "Wallet",        href: "/admin/wallet",         icon: Wallet          },
  { label: "Settings",      href: "/admin/settings",       icon: Settings        },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router   = useRouter();
  const { user, loading, logout } = useAuth();
  const { isConnected, address: walletAddress, chainId } = useWalletContext();

  const [collapsed, setCollapsed]       = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

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

        {/* Browser wallet status pill */}
        <div className={cn("px-2 pb-1", collapsed && "flex justify-center")}>
          <Link
            href="/admin/wallet"
            className={cn(
              "flex items-center gap-2 rounded-md border px-2.5 py-2 transition-colors",
              isConnected
                ? "border-yes/20 bg-yes/10 hover:bg-yes/15"
                : "border-destructive/20 bg-destructive/10 hover:bg-destructive/15",
              collapsed && "justify-center"
            )}
          >
            {isConnected
              ? <CheckCircle2 className="h-3.5 w-3.5 text-yes shrink-0" />
              : <AlertCircle  className="h-3.5 w-3.5 text-destructive shrink-0" />
            }
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-muted-foreground leading-tight">Wallet</p>
                <p className={cn("text-[10px] font-mono leading-tight truncate",
                  isConnected ? "text-yes" : "text-destructive")}>
                  {isConnected && walletAddress
                    ? `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}`
                    : "Disconnected"}
                </p>
              </div>
            )}
          </Link>
        </div>

        {/* User footer */}
        <div className="p-2 border-t border-border">
          {!collapsed ? (
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen((v) => !v)}
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 hover:bg-secondary transition-colors"
              >
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-brand text-primary-foreground text-[10px] font-bold shrink-0">
                  {initials}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-xs font-semibold text-foreground truncate">{user.name}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{user.email}</p>
                </div>
                <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform shrink-0", userMenuOpen && "rotate-180")} />
              </button>
              {userMenuOpen && (
                <div className="absolute bottom-full left-0 right-0 mb-1 rounded-lg border border-border bg-card shadow-xl overflow-hidden">
                  <button
                    onClick={() => { logout(); router.replace("/admin/login"); }}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <LogOut className="h-4 w-4" />
                    Log Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => { logout(); router.replace("/admin/login"); }}
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
            <div className="flex items-center gap-1.5 rounded-md border border-yes/30 bg-yes/10 px-2.5 py-1">
              <CircleDot className="h-3 w-3 text-yes" />
              <span className="text-xs font-medium text-yes">Live</span>
            </div>
            <AdminWalletConnect />
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
