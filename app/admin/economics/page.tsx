"use client";

import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, ReferenceLine } from "recharts";
import { RefreshCw, ExternalLink, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

const FRED_INDICATORS = [
  { id: "FEDFUNDS",  label: "Fed Funds Rate",         unit: "%",   color: "oklch(0.6 0.2 250)",  category: "Monetary" },
  { id: "UNRATE",    label: "Unemployment Rate",       unit: "%",   color: "oklch(0.58 0.22 25)", category: "Labor" },
  { id: "CPIAUCSL",  label: "CPI (Inflation)",         unit: " idx", color: "oklch(0.65 0.18 145)", category: "Prices" },
  { id: "T10Y2Y",    label: "Yield Curve (10Y–2Y)",    unit: "%",   color: "oklch(0.75 0.15 60)", category: "Treasury" },
  { id: "SP500",     label: "S&P 500",                 unit: "",    color: "oklch(0.7 0.18 300)", category: "Markets" },
  { id: "DTWEXBGS",  label: "USD Index",               unit: "",    color: "oklch(0.72 0.15 200)", category: "FX" },
  { id: "GDPC1",     label: "Real GDP",                unit: "B",   color: "oklch(0.68 0.12 80)", category: "Growth" },
  { id: "M2SL",      label: "M2 Money Supply",         unit: "B",   color: "oklch(0.62 0.14 320)", category: "Monetary" },
];

interface SeriesData {
  id: string;
  label: string;
  unit: string;
  color: string;
  category: string;
  current: number;
  prev: number;
  change: number;
  changePct: number;
  history: { date: string; value: number }[];
}

export default function AdminEconomics() {
  const [data, setData] = useState<SeriesData[]>([]);
  const [selected, setSelected] = useState<SeriesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = async () => {
    setLoading(true);
    const ids = FRED_INDICATORS.map((i) => i.id).join(",");
    try {
      const res = await fetch(`/api/fred/bulk?ids=${ids}`);
      if (!res.ok) throw new Error("FRED fetch failed");
      const raw: Record<string, { info: { title: string }; observations: { date: string; value: string }[] }> = await res.json();

      const parsed: SeriesData[] = FRED_INDICATORS.map((ind) => {
        const entry = raw[ind.id];
        const obs = (entry?.observations ?? [])
          .filter((o) => o.value !== "." && !isNaN(parseFloat(o.value)))
          .map((o) => ({ date: o.date, value: parseFloat(o.value) }))
          .sort((a, b) => a.date.localeCompare(b.date));
        const current = obs[obs.length - 1]?.value ?? 0;
        const prev = obs[obs.length - 2]?.value ?? current;
        const change = current - prev;
        const changePct = prev !== 0 ? (change / Math.abs(prev)) * 100 : 0;
        return { ...ind, current, prev, change, changePct, history: obs.slice(-36) };
      });

      setData(parsed);
      setSelected(parsed[0] ?? null);
      setLastUpdated(new Date());
    } catch {
      // leave empty
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const CATEGORIES = Array.from(new Set(FRED_INDICATORS.map((i) => i.category)));

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Economics — FRED Data</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Federal Reserve Bank of St. Louis — {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : "Loading..."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="https://fred.stlouisfed.org"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            FRED <ExternalLink className="h-3 w-3" />
          </a>
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

      {/* Detail chart */}
      {selected && (
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-start justify-between mb-5">
            <div>
              <p className="text-base font-bold text-foreground">{selected.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Series ID: {selected.id} · {selected.category}</p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold font-mono text-foreground">
                {selected.current.toLocaleString("en-US", { maximumFractionDigits: 2 })}{selected.unit}
              </p>
              <p className={cn("text-sm font-semibold mt-0.5 flex items-center gap-1 justify-end", selected.change >= 0 ? "text-yes" : "text-no")}>
                {selected.change >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                {selected.change >= 0 ? "+" : ""}{selected.change.toFixed(2)}{selected.unit} ({selected.changePct.toFixed(2)}%)
              </p>
            </div>
          </div>
          {loading ? (
            <div className="h-48 animate-pulse rounded-lg bg-secondary" />
          ) : (
            <ResponsiveContainer width="100%" height={192}>
              <LineChart data={selected.history} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
                <XAxis
                  dataKey="date"
                  tick={{ fill: "oklch(0.55 0.01 240)", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                  tickFormatter={(d) => d.slice(0, 7)}
                />
                <YAxis tick={{ fill: "oklch(0.55 0.01 240)", fontSize: 10 }} axisLine={false} tickLine={false} width={50} />
                <Tooltip
                  contentStyle={{ background: "oklch(0.16 0.006 240)", border: "1px solid oklch(0.22 0.008 240)", borderRadius: 8, fontSize: 11 }}
                  labelStyle={{ color: "oklch(0.95 0.005 240)" }}
                  formatter={(v: number) => [`${v.toFixed(2)}${selected.unit}`, selected.label]}
                />
                <ReferenceLine y={selected.prev} stroke="oklch(0.35 0.01 240)" strokeDasharray="4 4" />
                <Line type="monotone" dataKey="value" stroke={selected.color} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      )}

      {/* Indicators grid */}
      {CATEGORIES.map((cat) => (
        <div key={cat}>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">{cat}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {data
              .filter((d) => d.category === cat)
              .map((d) => {
                const isSelected = selected?.id === d.id;
                return (
                  <button
                    key={d.id}
                    onClick={() => setSelected(d)}
                    className={cn(
                      "rounded-xl border bg-card p-4 text-left transition-all hover:border-brand/40",
                      isSelected ? "border-brand/60 bg-brand/5" : "border-border"
                    )}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs text-muted-foreground font-medium">{d.label}</p>
                      <span className="text-[10px] font-mono text-muted-foreground">{d.id}</span>
                    </div>
                    <p className="text-xl font-bold font-mono text-foreground">
                      {loading ? "—" : d.current.toLocaleString("en-US", { maximumFractionDigits: 2 })}{d.unit}
                    </p>
                    <div className={cn("flex items-center gap-1 text-xs font-semibold mt-1.5", d.change >= 0 ? "text-yes" : "text-no")}>
                      {d.change > 0 ? <TrendingUp className="h-3 w-3" /> : d.change < 0 ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                      {!loading && (
                        <span>{d.change >= 0 ? "+" : ""}{d.change.toFixed(2)} ({d.changePct.toFixed(1)}%)</span>
                      )}
                    </div>
                    {/* Mini sparkline */}
                    {d.history.length > 0 && !loading && (
                      <ResponsiveContainer width="100%" height={36} className="mt-2">
                        <LineChart data={d.history.slice(-12)} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                          <Line type="monotone" dataKey="value" stroke={d.color} strokeWidth={1.5} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                  </button>
                );
              })}
          </div>
        </div>
      ))}
    </div>
  );
}
