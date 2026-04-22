"use client";

import { useState, useEffect } from "react";
import {
  Store, TrendingUp,
  Receipt, ArrowUpCircle, ShoppingBag, Wallet, Loader2,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";
import Link from "next/link";

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface DashboardData {
  walletBalance: number;
  totalCommissionPaid: number;
  orders: { total: number; active: number };
  pendingFundRequests: number;
  volume: number;
}

export default function MerchantDashboardPage() {
  const { user, token } = useAuth();
  const [dash, setDash]       = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    fetch(`${BACKEND}/api/merchant/dashboard`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setDash(d.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  if (!user) return null;

  return (
    <div className="flex flex-col gap-6">

      {/* ── Welcome banner ── */}
      <div className="rounded-2xl border border-border bg-card p-6 flex items-start gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/20 shrink-0">
          <Store className="h-7 w-7 text-brand" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Welcome back, {user.name.split(" ")[0]}!
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your orders and track your account activity.
          </p>
        </div>
      </div>

      {/* ── Summary cards ── */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-28 rounded-xl bg-secondary animate-pulse" />)}
        </div>
      ) : dash ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Link href="/merchant/wallet"
            className="rounded-xl border border-border bg-card p-4 flex flex-col gap-2 hover:border-yes/40 transition-colors group cursor-pointer">
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium uppercase tracking-wider">
              <Wallet className="h-3.5 w-3.5 text-yes" /> Balance
            </div>
            <p className="text-2xl font-bold font-mono text-yes">${dash.walletBalance.toFixed(2)}</p>
            <p className="text-xs text-brand group-hover:underline">View wallet</p>
          </Link>

          <Link href="/merchant/fund-requests"
            className="rounded-xl border border-border bg-card p-4 flex flex-col gap-2 hover:border-brand/40 transition-colors group cursor-pointer">
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium uppercase tracking-wider">
              <ArrowUpCircle className="h-3.5 w-3.5 text-brand" /> Fund Requests
            </div>
            <p className="text-2xl font-bold font-mono text-brand">{dash.pendingFundRequests}</p>
            <p className="text-xs text-muted-foreground">pending</p>
          </Link>

          <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium uppercase tracking-wider">
              <Receipt className="h-3.5 w-3.5 text-chart-4" /> Commission Paid
            </div>
            <p className="text-2xl font-bold font-mono text-chart-4">${dash.totalCommissionPaid.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">total deducted</p>
          </div>

          <Link href="/merchant/orders"
            className="rounded-xl border border-border bg-card p-4 flex flex-col gap-2 hover:border-brand/40 transition-colors group cursor-pointer">
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium uppercase tracking-wider">
              <ShoppingBag className="h-3.5 w-3.5 text-brand" /> Orders
            </div>
            <p className="text-2xl font-bold font-mono text-foreground">{dash.orders.total}</p>
            <p className="text-xs text-muted-foreground">{dash.orders.active} active</p>
          </Link>
        </div>
      ) : null}

      {/* ── Trade volume card ── */}
      {dash && dash.volume > 0 && (
        <div className="rounded-xl border border-border bg-card p-5 flex items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/15 shrink-0">
            <TrendingUp className="h-5 w-5 text-brand" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Total Trade Volume</p>
            <p className="text-xl font-bold font-mono text-foreground mt-0.5">${dash.volume.toFixed(2)}</p>
          </div>
        </div>
      )}

      {/* ── Info box ── */}
      <div className="rounded-xl border border-brand/20 bg-brand/5 px-5 py-4 flex items-start gap-3">
        <Wallet className="h-5 w-5 text-brand mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-foreground">Order Execution via Platform Wallet</p>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            All market orders are executed through the platform's trading wallet.
            Your account balance is debited for the order amount plus applicable commission on each trade.
            Add funds via a Fund Request to increase your available balance.
          </p>
        </div>
      </div>

    </div>
  );
}
