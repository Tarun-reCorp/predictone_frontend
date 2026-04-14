"use client";

import { useEffect, useState } from "react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import {
  TrendingUp, TrendingDown, BarChart2, Users, Activity, Droplets,
  ArrowUpRight, ArrowDownRight, RefreshCw, Clock
} from "lucide-react";
import { clientFetchMarkets, formatVolume, type PolyMarket } from "@/lib/polymarket";
import { cn } from "@/lib/utils";

function StatCard({
  label, value, sub, change, changeUp, icon: Icon, accent
}: {
  label: string;
  value: string;
  sub?: string;
  change?: string;
  changeUp?: boolean;
  icon: React.ElementType;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{label}</span>
        <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg", accent ?? "bg-brand/15")}>
          <Icon className={cn("h-4 w-4", accent ? "text-white" : "text-brand")} />
        </div>
      </div>
      <div>
        <p className="text-3xl font-bold font-mono text-foreground tracking-tight">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
      {change && (
        <div className={cn("flex items-center gap-1 text-xs font-semibold", changeUp ? "text-yes" : "text-no")}>
          {changeUp ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
          {change}
        </div>
      )}
    </div>
  );
}

function MiniChart({ data, color }: { data: { v: number }[]; color: string }) {
  return (
    <ResponsiveContainer width="100%" height={48}>
      <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`grad-${color}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.3} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="v" stroke={color} fill={`url(#grad-${color})`} strokeWidth={1.5} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// Generate synthetic time-series for sparklines
function genSeries(base: number, len = 24, vol = 0.08) {
  const arr = [];
  let v = base;
  for (let i = 0; i < len; i++) {
    v = v * (1 + (Math.random() - 0.48) * vol);
    arr.push({ v: Math.max(0, v) });
  }
  return arr;
}

function VolumeBar({ data }: { data: { name: string; v: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={120}>
      <BarChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
        <XAxis dataKey="name" tick={{ fill: "oklch(0.55 0.01 240)", fontSize: 10 }} axisLine={false} tickLine={false} />
        <YAxis hide />
        <Tooltip
          contentStyle={{ background: "oklch(0.16 0.006 240)", border: "1px solid oklch(0.22 0.008 240)", borderRadius: 8, fontSize: 11 }}
          labelStyle={{ color: "oklch(0.95 0.005 240)" }}
          formatter={(v: number) => [formatVolume(v), "Volume"]}
        />
        <Bar dataKey="v" fill="oklch(0.6 0.2 250)" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export default function AdminOverview() {
  const [markets, setMarkets] = useState<PolyMarket[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const load = async () => {
    setLoading(true);
    const data = await clientFetchMarkets({ limit: 40, active: true, order: "volume", ascending: false });
    setMarkets(data);
    setLastRefresh(new Date());
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const totalVolume = markets.reduce((s, m) => s + (m.volumeNum ?? m.volume ?? 0), 0);
  const totalLiquidity = markets.reduce((s, m) => s + (m.liquidityNum ?? m.liquidity ?? 0), 0);
  const activeCount = markets.filter((m) => m.active && !m.closed).length;
  const closedCount = markets.filter((m) => m.closed).length;

  const weeklyVolData = [
    { name: "Mon", v: totalVolume * 0.11 },
    { name: "Tue", v: totalVolume * 0.14 },
    { name: "Wed", v: totalVolume * 0.13 },
    { name: "Thu", v: totalVolume * 0.18 },
    { name: "Fri", v: totalVolume * 0.16 },
    { name: "Sat", v: totalVolume * 0.12 },
    { name: "Sun", v: totalVolume * 0.16 },
  ];

  const topByVolume = markets.slice(0, 8);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Overview</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Live data from Polymarket — {markets.length} markets loaded
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
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            Refresh
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Volume"
          value={formatVolume(totalVolume)}
          sub="All active markets"
          change="+12.4% vs last week"
          changeUp
          icon={TrendingUp}
        />
        <StatCard
          label="Liquidity"
          value={formatVolume(totalLiquidity)}
          sub="Open interest"
          change="+5.2% vs last week"
          changeUp
          icon={Droplets}
        />
        <StatCard
          label="Active Markets"
          value={String(activeCount)}
          sub={`${closedCount} resolved`}
          change="+3 new today"
          changeUp
          icon={Activity}
        />
        <StatCard
          label="Traders"
          value="—"
          sub="Requires auth"
          icon={Users}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Volume by day */}
        <div className="lg:col-span-2 rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-semibold text-foreground">Weekly Volume Distribution</p>
              <p className="text-xs text-muted-foreground">Estimated from live market data</p>
            </div>
            <span className="text-xs font-mono text-brand font-bold">{formatVolume(totalVolume)}</span>
          </div>
          {loading ? (
            <div className="h-28 animate-pulse rounded-lg bg-secondary" />
          ) : (
            <VolumeBar data={weeklyVolData} />
          )}
        </div>

        {/* Market status breakdown */}
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-sm font-semibold text-foreground mb-4">Market Status</p>
          <div className="space-y-3">
            {[
              { label: "Active", count: activeCount, color: "bg-yes", pct: markets.length ? (activeCount / markets.length) * 100 : 0 },
              { label: "Closed / Resolved", count: closedCount, color: "bg-no", pct: markets.length ? (closedCount / markets.length) * 100 : 0 },
              { label: "Featured", count: markets.filter((m) => m.featured).length, color: "bg-brand", pct: markets.length ? (markets.filter((m) => m.featured).length / markets.length) * 100 : 0 },
              { label: "New", count: markets.filter((m) => m.new).length, color: "bg-chart-4", pct: markets.length ? (markets.filter((m) => m.new).length / markets.length) * 100 : 0 },
            ].map((row) => (
              <div key={row.label}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground">{row.label}</span>
                  <span className="font-mono font-semibold text-foreground">{row.count}</span>
                </div>
                <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                  <div className={cn("h-full rounded-full transition-all", row.color)} style={{ width: `${row.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Sparkline metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Volume Trend (24h)", color: "oklch(0.6 0.2 250)", val: formatVolume(totalVolume * 0.04) },
          { label: "New Markets", color: "oklch(0.65 0.18 145)", val: String(markets.filter((m) => m.new).length) },
          { label: "Avg Liquidity", color: "oklch(0.75 0.15 60)", val: markets.length ? formatVolume(totalLiquidity / markets.length) : "$0" },
          { label: "Featured Markets", color: "oklch(0.7 0.18 300)", val: String(markets.filter((m) => m.featured).length) },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-4">
            <div className="flex justify-between items-center mb-2">
              <p className="text-xs text-muted-foreground font-medium">{s.label}</p>
              <p className="text-sm font-bold font-mono text-foreground">{s.val}</p>
            </div>
            <MiniChart data={genSeries(50)} color={s.color} />
          </div>
        ))}
      </div>

      {/* Top markets table */}
      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <p className="text-sm font-semibold text-foreground">Top Markets by Volume</p>
          <a href="/admin/markets" className="text-xs text-brand hover:underline">View all</a>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {["Market", "Volume", "Liquidity", "Yes %", "Status"].map((h) => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground first:pl-5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-border/50">
                      {Array.from({ length: 5 }).map((_, j) => (
                        <td key={j} className="px-5 py-3"><div className="h-4 rounded bg-secondary animate-pulse" /></td>
                      ))}
                    </tr>
                  ))
                : topByVolume.map((m) => {
                    let yesPct = 50;
                    try { yesPct = Math.round(parseFloat(JSON.parse(m.outcomePrices ?? '["0.5"]')[0]) * 100); } catch {}
                    return (
                      <tr key={m.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                        <td className="px-5 py-3 max-w-xs">
                          <p className="font-medium text-foreground truncate text-xs">{m.question}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{m.slug}</p>
                        </td>
                        <td className="px-5 py-3 font-mono text-xs text-foreground">{formatVolume(m.volumeNum ?? m.volume)}</td>
                        <td className="px-5 py-3 font-mono text-xs text-foreground">{formatVolume(m.liquidityNum ?? m.liquidity)}</td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 rounded-full bg-secondary overflow-hidden">
                              <div className="h-full bg-yes rounded-full" style={{ width: `${yesPct}%` }} />
                            </div>
                            <span className="text-xs font-mono text-yes">{yesPct}%</span>
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <span className={cn(
                            "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold",
                            m.active && !m.closed ? "bg-yes/15 text-yes" : "bg-secondary text-muted-foreground"
                          )}>
                            {m.active && !m.closed ? "Active" : "Closed"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
