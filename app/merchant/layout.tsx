"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  TrendingUp, LayoutDashboard, User, ChevronRight,
  CircleDot, Bell, LogOut, ChevronDown,
  Wallet, CheckCircle2, Loader2, Copy, Unplug, ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import { useWallet } from "@/hooks/use-wallet";
import { shortenAddress, getChainName } from "@/lib/wallet";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/merchant",         icon: LayoutDashboard },
  { label: "Profile",   href: "/merchant/profile", icon: User },
];

export default function MerchantLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const wallet = useWallet();
  const [collapsed, setCollapsed] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [walletMenuOpen, setWalletMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const walletMenuRef = useRef<HTMLDivElement>(null);

  const handleCopy = async () => {
    await wallet.copyAddress();
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // Close wallet menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (walletMenuRef.current && !walletMenuRef.current.contains(e.target as Node)) {
        setWalletMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Auth guard
  useEffect(() => {
    if (!loading && !user) router.replace("/");
    if (!loading && user && user.role !== "merchant") router.replace("/admin");
  }, [user, loading, router]);

  if (loading || !user || user.role !== "merchant") return null;

  const initials = user.name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");

  const breadcrumb =
    pathname === "/merchant"
      ? "Dashboard"
      : pathname.split("/merchant/")[1]?.replace(/-/g, " ") ?? "Merchant";

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className={cn(
        "flex flex-col border-r border-border bg-[oklch(0.13_0.005_240)] transition-all duration-200 shrink-0",
        collapsed ? "w-14" : "w-56"
      )}>
        {/* Sidebar header */}
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
                <p className="text-[10px] text-muted-foreground font-medium tracking-wider uppercase">Merchant</p>
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

        {/* Nav items */}
        <nav className="flex flex-col gap-0.5 p-2 flex-1">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === "/merchant"
                ? pathname === "/merchant"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
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

        {/* Wallet */}
        <div className="px-2 pb-2 relative" ref={walletMenuRef}>
          {wallet.address ? (
            <>
              <button
                onClick={() => setWalletMenuOpen((v) => !v)}
                title={wallet.address}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2.5 py-2 transition-colors",
                  "bg-yes/10 border border-yes/20 hover:bg-yes/15",
                  collapsed && "justify-center"
                )}
              >
                <CheckCircle2 className="h-4 w-4 text-yes shrink-0" />
                {!collapsed && (
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-xs font-mono text-yes truncate leading-tight">
                      {shortenAddress(wallet.address)}
                    </p>
                    <p className="text-[10px] text-muted-foreground leading-tight">
                      {getChainName(wallet.chainId)}
                    </p>
                  </div>
                )}
              </button>

              {/* Wallet popover menu */}
              {walletMenuOpen && !collapsed && (
                <div className="absolute bottom-full left-0 right-0 mb-1 rounded-lg border border-border bg-card shadow-xl overflow-hidden z-50">
                  {/* Address display */}
                  <div className="px-3 py-2.5 border-b border-border">
                    <p className="text-[10px] text-muted-foreground mb-0.5">Connected wallet</p>
                    <p className="text-xs font-mono text-foreground break-all">{wallet.address}</p>
                    {wallet.chainId && (
                      <span className="mt-1 inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">
                        {getChainName(wallet.chainId)}
                      </span>
                    )}
                  </div>
                  {/* Actions */}
                  <div className="p-1">
                    <button
                      onClick={() => { handleCopy(); }}
                      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      {copied ? "Copied!" : "Copy Address"}
                    </button>
                    <a
                      href={`https://polygonscan.com/address/${wallet.address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setWalletMenuOpen(false)}
                      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      View on Explorer
                    </a>
                    <button
                      onClick={() => { wallet.disconnect(); setWalletMenuOpen(false); }}
                      disabled={wallet.isDisconnecting}
                      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-60"
                    >
                      {wallet.isDisconnecting
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <Unplug className="h-3.5 w-3.5" />
                      }
                      Disconnect
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <button
                onClick={wallet.connect}
                disabled={wallet.isConnecting}
                title={!wallet.isInstalled ? "Install MetaMask to connect" : "Connect Wallet"}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
                  "bg-brand/10 text-brand border border-brand/20 hover:bg-brand/20 disabled:opacity-60",
                  collapsed && "justify-center"
                )}
              >
                {wallet.isConnecting
                  ? <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                  : <Wallet className="h-4 w-4 shrink-0" />
                }
                {!collapsed && (wallet.isConnecting ? "Connecting…" : "Connect Wallet")}
              </button>
              {wallet.error && !collapsed && (
                <p className="mt-1 px-1 text-[10px] text-destructive leading-tight">{wallet.error}</p>
              )}
              {!wallet.isInstalled && !collapsed && (
                <a
                  href="https://metamask.io/download/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 flex items-center gap-1 px-1 text-[10px] text-brand hover:underline"
                >
                  <ExternalLink className="h-2.5 w-2.5" /> Install MetaMask
                </a>
              )}
            </>
          )}
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
                    onClick={() => { logout(); router.replace("/merchant/login"); }}
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
              onClick={() => { logout(); router.replace("/merchant/login"); }}
              className="flex w-full items-center justify-center p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-secondary transition-colors"
              title="Log Out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Top bar */}
        <header className="flex h-14 items-center justify-between border-b border-border px-6 bg-background/80 backdrop-blur-sm sticky top-0 z-40">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link href="/" className="hover:text-foreground transition-colors">PredictOne</Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-foreground font-medium capitalize">{breadcrumb}</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 rounded-md border border-yes/30 bg-yes/10 px-2.5 py-1">
              <CircleDot className="h-3 w-3 text-yes" />
              <span className="text-xs font-medium text-yes">Active</span>
            </div>
            <button className="relative flex h-8 w-8 items-center justify-center rounded-md border border-border hover:bg-secondary transition-colors">
              <Bell className="h-4 w-4 text-muted-foreground" />
            </button>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-primary-foreground text-xs font-bold">
              {initials}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
