"use client";

import { useEffect, useState, useRef } from "react";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { Activity, TrendingUp, TrendingDown, RefreshCw, Play, Pause, Zap } from "lucide-react";
import { clientFetchMarkets, clientFetchPriceHistory, formatVolume, type PolyMarket, type PriceHistory } from "@/lib/polymarket";
import { cn } from "@/lib/utils";

type Side = "BUY" | "SELL";

interface Trade {
  id: string;
  market: string;
  outcome: string;
  side: Side;
  price: number;
  size: number;
  total: number;
  ts: number;
}

function generateTrade(markets: PolyMarket[]): Trade {
  const m = markets[Math.floor(Math.random() * markets.length)];
  const side: Side = Math.random() > 0.5 ? "BUY" : "SELL";
  const price = 0.3 + Math.random() * 0.4;
  const size = Math.round(50 + Math.random() * 950);
  return {
    id: Math.random().toString(36).slice(2, 10),
    market: m?.question?.slice(0, 60) ?? "Unknown Market",
    outcome: Math.random() > 0.5 ? "Yes" : "No",
    side,
    price,
    size,
    total: price * size,
    ts: Date.now(),
  };
}

export default function AdminTrades() {
  const [markets, setMarkets] = useState<PolyMarket[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [priceData, setPriceData] = useState<PriceHistory[]>([]);
  const [selectedMarket, setSelectedMarket] = useState<PolyMarket | null>(null);
  const [live, setLive] = useState(true);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const marketsRef = useRef<PolyMarket[]>([]);

  const load = async () => {
    setLoading(true);
    const data = await clientFetchMarkets({ limit: 30, active: true, order: "volume", ascending: false });
    setMarkets(data);
    if (data.length > 0) {
      setSelectedMarket(data[0]);
      const hist = await clientFetchPriceHistory(data[0].conditionId, "1d");
      setPriceData(hist);
    }
    // Seed initial trades
    if (data.length > 0) {
      setTrades(Array.from({ length: 15 }, () => generateTrade(data)));
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // Keep ref in sync so the interval always reads latest markets without being
  // a dependency of the interval effect (which would restart it on every load).
  useEffect(() => { marketsRef.current = markets; }, [markets]);

  // Live trade feed simulation — only depends on `live`, not `markets`
  useEffect(() => {
    if (!live) return;
    intervalRef.current = setInterval(() => {
      if (marketsRef.current.length === 0) return;
      const t = generateTrade(marketsRef.current);
      setTrades((prev) => [t, ...prev].slice(0, 100));
    }, 1800);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [live]);

  const selectMarket = async (m: PolyMarket) => {
    setSelectedMarket(m);
    const hist = await clientFetchPriceHistory(m.conditionId, "1d");
    setPriceData(hist);
  };

  const chartData = priceData.map((p) => ({
    t: new Date(p.t * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    price: Math.round(p.p * 100),
  }));

  const buyCount = trades.filter((t) => t.side === "BUY").length;
  const sellCount = trades.filter((t) => t.side === "SELL").length;
  const totalNotional = trades.reduce((s, t) => s + t.total, 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Trades & Activity</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Simulated live trade feed — {trades.length} trades logged</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setLive(!live)}
            className={cn(
              "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
              live ? "border-yes/40 bg-yes/10 text-yes" : "border-border text-muted-foreground hover:text-foreground hover:bg-secondary"
            )}
          >
            {live ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            {live ? "Pause" : "Resume"} Feed
          </button>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Trades", value: String(trades.length), icon: Activity, color: "text-brand" },
          { label: "Buy Orders", value: String(buyCount), icon: TrendingUp, color: "text-yes" },
          { label: "Sell Orders", value: String(sellCount), icon: TrendingDown, color: "text-no" },
          { label: "Notional Volume", value: `$${totalNotional.toFixed(0)}`, icon: Zap, color: "text-chart-4" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-4 flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary shrink-0">
              <s.icon className={cn("h-5 w-5", s.color)} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="text-xl font-bold font-mono text-foreground">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Price chart */}
        <div className="lg:col-span-2 rounded-xl border border-border bg-card p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-sm font-semibold text-foreground">Price History</p>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1 max-w-xs">
                {selectedMarket?.question ?? "Select a market"}
              </p>
            </div>
            <select
              className="text-xs rounded-md border border-border bg-secondary text-foreground px-2 py-1 outline-none"
              onChange={(e) => {
                const m = markets.find((mk) => mk.id === e.target.value);
                if (m) selectMarket(m);
              }}
              value={selectedMarket?.id ?? ""}
            >
              {markets.slice(0, 15).map((m) => (
                <option key={m.id} value={m.id}>{m.question?.slice(0, 50)}</option>
              ))}
            </select>
          </div>
          {loading || chartData.length === 0 ? (
            <div className="h-40 animate-pulse rounded-lg bg-secondary" />
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <XAxis dataKey="t" tick={{ fill: "oklch(0.55 0.01 240)", fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fill: "oklch(0.55 0.01 240)", fontSize: 10 }} axisLine={false} tickLine={false} domain={[0, 100]} tickFormatter={(v) => `$${(v / 100).toFixed(2)}`} />
                <Tooltip
                  contentStyle={{ background: "oklch(0.16 0.006 240)", border: "1px solid oklch(0.22 0.008 240)", borderRadius: 8, fontSize: 11 }}
                  formatter={(v: number) => [`$${(v / 100).toFixed(2)}`, "Yes Price"]}
                />
                <Line type="monotone" dataKey="price" stroke="oklch(0.65 0.18 145)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Buy/Sell ratio */}
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-sm font-semibold text-foreground mb-4">Order Flow</p>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-yes font-medium">Buy</span>
                <span className="font-mono font-semibold text-foreground">{buyCount} orders ({trades.length ? Math.round((buyCount / trades.length) * 100) : 0}%)</span>
              </div>
              <div className="h-2 rounded-full bg-secondary overflow-hidden">
                <div className="h-full bg-yes rounded-full transition-all" style={{ width: `${trades.length ? (buyCount / trades.length) * 100 : 50}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-no font-medium">Sell</span>
                <span className="font-mono font-semibold text-foreground">{sellCount} orders ({trades.length ? Math.round((sellCount / trades.length) * 100) : 0}%)</span>
              </div>
              <div className="h-2 rounded-full bg-secondary overflow-hidden">
                <div className="h-full bg-no rounded-full transition-all" style={{ width: `${trades.length ? (sellCount / trades.length) * 100 : 50}%` }} />
              </div>
            </div>
            <div className="pt-2 border-t border-border">
              <p className="text-xs text-muted-foreground mb-2">Avg trade size</p>
              <p className="text-xl font-bold font-mono text-foreground">
                ${trades.length ? (totalNotional / trades.length).toFixed(2) : "0.00"}
              </p>
            </div>
            <div className="pt-2 border-t border-border">
              <p className="text-xs text-muted-foreground mb-2">Largest single trade</p>
              <p className="text-xl font-bold font-mono text-foreground">
                ${trades.length ? Math.max(...trades.map((t) => t.total)).toFixed(2) : "0.00"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Live trade feed */}
      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-foreground">Live Trade Feed</p>
            {live && (
              <span className="flex items-center gap-1 rounded-full bg-yes/15 px-2 py-0.5 text-[10px] font-semibold text-yes">
                <span className="h-1.5 w-1.5 rounded-full bg-yes animate-pulse" />
                Live
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{trades.length} events</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 bg-secondary/20">
                {["Time", "Market", "Outcome", "Side", "Price", "Size", "Total"].map((h) => (
                  <th key={h} className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {trades.slice(0, 30).map((t, i) => (
                <tr
                  key={t.id}
                  className={cn(
                    "border-b border-border/30 transition-colors",
                    i === 0 && live ? "bg-brand/5" : "hover:bg-secondary/10"
                  )}
                >
                  <td className="px-5 py-2.5 font-mono text-[10px] text-muted-foreground whitespace-nowrap">
                    {new Date(t.ts).toLocaleTimeString()}
                  </td>
                  <td className="px-5 py-2.5 max-w-[200px]">
                    <p className="text-xs text-foreground truncate">{t.market}</p>
                  </td>
                  <td className="px-5 py-2.5">
                    <span className={cn("text-xs font-semibold", t.outcome === "Yes" ? "text-yes" : "text-no")}>{t.outcome}</span>
                  </td>
                  <td className="px-5 py-2.5">
                    <span className={cn(
                      "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold",
                      t.side === "BUY" ? "bg-yes/15 text-yes" : "bg-no/15 text-no"
                    )}>
                      {t.side}
                    </span>
                  </td>
                  <td className="px-5 py-2.5 font-mono text-xs text-foreground">${t.price.toFixed(2)}</td>
                  <td className="px-5 py-2.5 font-mono text-xs text-foreground">{t.size}</td>
                  <td className="px-5 py-2.5 font-mono text-xs font-semibold text-foreground">${t.total.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
