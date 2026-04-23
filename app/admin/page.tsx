"use client";

import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import {
  Users, Activity, RefreshCw, Clock,
  ShoppingBag, TrendingUp, Wallet, FileCheck,
  BarChart2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

// ── Types ──────────────────────────────────────────────────────────────────────

interface DashboardData {
  merchants:   { total: number; active: number; blocked: number };
  orders:      { total: number; pending: number };
  volume:      { total: number };
  markets:     { total: number; active: number; resolved: number; cancelled: number };
  fundRequests:{ total: number; approved: number; pending: number; rejected: number; today: number };
  pendingFundRequests: number;
  topMerchants: { _id: string; name?: string; email?: string; totalVolume: number; orderCount: number }[];
}

function fmtVolume(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

function StatCard({
  label, value, sub, icon: Icon, accent, iconBg,
}: {
  label: string; value: string; sub?: string;
  icon: React.ElementType; accent?: string; iconBg?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{label}</span>
        <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg", iconBg ?? "bg-brand/15")}>
          <Icon className={cn("h-4 w-4", accent ?? "text-brand")} />
        </div>
      </div>
      <div>
        <p className="text-3xl font-bold font-mono text-foreground tracking-tight">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ── Main overview page ─────────────────────────────────────────────────────────

export default function AdminOverview() {
  const { token } = useAuth();

  const [dashboard, setDashboard]     = useState<DashboardData | null>(null);
  const [dashLoading, setDashLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const loadDashboard = async () => {
    if (!token) return;
    setDashLoading(true);
    try {
      const res = await fetch(`${BACKEND}/api/admin/dashboard`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setDashboard(data.data ?? data);
      setLastRefresh(new Date());
    } catch {
      // keep previous data
    } finally {
      setDashLoading(false);
    }
  };

  useEffect(() => { loadDashboard(); }, [token]);

  const d = dashboard;

  const marketBarData = d ? [
    { name: "Active",    v: d.markets.active },
    { name: "Resolved",  v: d.markets.resolved },
    { name: "Cancelled", v: d.markets.cancelled },
  ] : [];

  const frBarData = d ? [
    { name: "Approved", v: d.fundRequests.approved },
    { name: "Pending",  v: d.fundRequests.pending },
    { name: "Rejected", v: d.fundRequests.rejected },
  ] : [];

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Overview</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Platform statistics and activity
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastRefresh && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              Refreshed {lastRefresh.toLocaleTimeString()}
            </div>
          )}
          <button
            onClick={loadDashboard}
            disabled={dashLoading}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", dashLoading && "animate-spin")} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Stat cards ── */}
      {dashLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-5 h-28 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard label="Total Merchants"  value={String(d?.merchants.total ?? 0)}
            sub={`${d?.merchants.blocked ?? 0} blocked`}
            icon={Users}      accent="text-brand"    iconBg="bg-brand/15" />
          <StatCard label="Active Merchants" value={String(d?.merchants.active ?? 0)}
            sub="Currently active"
            icon={Activity}   accent="text-yes"      iconBg="bg-yes/15" />
          <StatCard label="Total Orders"     value={String(d?.orders.total ?? 0)}
            sub={`${d?.orders.pending ?? 0} pending`}
            icon={ShoppingBag} accent="text-chart-4" iconBg="bg-chart-4/15" />
          <StatCard label="Total Volume"     value={fmtVolume(d?.volume.total ?? 0)}
            sub="All-time order volume"
            icon={TrendingUp}  accent="text-brand"   iconBg="bg-brand/15" />
          <StatCard label="Total Markets"    value={String(d?.markets.total ?? 0)}
            sub={`${d?.markets.active ?? 0} active`}
            icon={BarChart2}   accent="text-chart-4" iconBg="bg-chart-4/15" />
          <StatCard label="Pending Fund Reqs" value={String(d?.fundRequests.pending ?? 0)}
            sub={`${d?.fundRequests.today ?? 0} submitted today`}
            icon={Wallet}      accent="text-no"      iconBg="bg-no/15" />
        </div>
      )}

      {/* ── Market Status + Fund Request charts ── */}
      {!dashLoading && d && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Market Status */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm font-semibold text-foreground">Market Status</p>
                <p className="text-xs text-muted-foreground">{d.markets.total} total markets in DB</p>
              </div>
              <a href="/admin/markets" className="text-xs text-brand hover:underline">View all</a>
            </div>
            <div className="space-y-3 mb-4">
              {[
                { label: "Active",    count: d.markets.active,    color: "bg-yes",   pct: d.markets.total ? (d.markets.active / d.markets.total) * 100 : 0 },
                { label: "Resolved",  count: d.markets.resolved,  color: "bg-brand", pct: d.markets.total ? (d.markets.resolved / d.markets.total) * 100 : 0 },
                { label: "Cancelled", count: d.markets.cancelled, color: "bg-no",    pct: d.markets.total ? (d.markets.cancelled / d.markets.total) * 100 : 0 },
              ].map((row) => (
                <div key={row.label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">{row.label}</span>
                    <span className="font-mono font-semibold text-foreground">{row.count}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                    <div className={cn("h-full rounded-full transition-all", row.color)} style={{ width: `${Math.min(row.pct, 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <ResponsiveContainer width="100%" height={90}>
              <BarChart data={marketBarData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fill: "oklch(0.55 0.01 240)", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip
                  contentStyle={{ background: "oklch(0.16 0.006 240)", border: "1px solid oklch(0.22 0.008 240)", borderRadius: 8, fontSize: 11 }}
                  formatter={(v: number) => [v, "Markets"]}
                />
                <Bar dataKey="v" fill="oklch(0.6 0.2 250)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Fund Requests Summary */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm font-semibold text-foreground">Fund Requests</p>
                <p className="text-xs text-muted-foreground">{d.fundRequests.total} total requests</p>
              </div>
              <a href="/admin/fund-requests" className="text-xs text-brand hover:underline">View all</a>
            </div>
            <div className="space-y-3 mb-4">
              {[
                { label: "Approved", count: d.fundRequests.approved, color: "bg-yes",     pct: d.fundRequests.total ? (d.fundRequests.approved / d.fundRequests.total) * 100 : 0 },
                { label: "Pending",  count: d.fundRequests.pending,  color: "bg-chart-4", pct: d.fundRequests.total ? (d.fundRequests.pending / d.fundRequests.total) * 100 : 0 },
                { label: "Rejected", count: d.fundRequests.rejected, color: "bg-no",      pct: d.fundRequests.total ? (d.fundRequests.rejected / d.fundRequests.total) * 100 : 0 },
              ].map((row) => (
                <div key={row.label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">{row.label}</span>
                    <span className="font-mono font-semibold text-foreground">{row.count}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                    <div className={cn("h-full rounded-full transition-all", row.color)} style={{ width: `${Math.min(row.pct, 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <ResponsiveContainer width="100%" height={90}>
              <BarChart data={frBarData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fill: "oklch(0.55 0.01 240)", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip
                  contentStyle={{ background: "oklch(0.16 0.006 240)", border: "1px solid oklch(0.22 0.008 240)", borderRadius: 8, fontSize: 11 }}
                  formatter={(v: number) => [v, "Requests"]}
                />
                <Bar dataKey="v" fill="oklch(0.6 0.2 250)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── Top Merchants by Volume ── */}
      {!dashLoading && d && d.topMerchants.length > 0 && (
        <div className="rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div className="flex items-center gap-2">
              <FileCheck className="h-4 w-4 text-brand" />
              <p className="text-sm font-semibold text-foreground">Top Merchants by Volume</p>
            </div>
            <a href="/admin/merchants" className="text-xs text-brand hover:underline">View all</a>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/30">
                  {["#", "Merchant", "Total Volume", "Orders"].map((h) => (
                    <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {d.topMerchants.map((m, idx) => (
                  <tr key={m._id} className="hover:bg-secondary/20 transition-colors">
                    <td className="px-5 py-4 text-sm text-muted-foreground font-mono">{idx + 1}</td>
                    <td className="px-5 py-4">
                      <p className="text-sm font-medium text-foreground">{m.name ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">{m.email ?? m._id}</p>
                    </td>
                    <td className="px-5 py-4 font-mono text-sm text-foreground font-semibold">
                      {fmtVolume(m.totalVolume)}
                    </td>
                    <td className="px-5 py-4 text-sm text-muted-foreground">
                      {m.orderCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
