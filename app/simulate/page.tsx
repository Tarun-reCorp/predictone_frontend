"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Play, Pause, RefreshCw, FlaskConical, TrendingUp, TrendingDown,
  Activity, DollarSign, Users, Zap, BarChart2, ArrowUpRight, ArrowDownRight,
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  type SimMarket, type SimPortfolio,
  generateSimMarkets, tickMarket,
  createPortfolio, placeTrade, calcPortfolioPnL,
  formatSimVolume,
} from "@/lib/simulation";

const TICK_INTERVAL_MS = 1200; // how often markets update
const CATEGORY_COLORS: Record<string, string> = {
  politics: "text-blue-400", crypto: "text-yellow-400", sports: "text-green-400",
  ai: "text-purple-400", tech: "text-cyan-400", economy: "text-orange-400",
  science: "text-pink-400",
};

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
function ChartTooltip({ active, payload }: { active?: boolean; payload?: { value: number }[] }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-xl">
      <span className="font-semibold text-foreground">{Math.round((payload[0].value ?? 0) * 100)}%</span>
      <span className="ml-1 text-muted-foreground">Yes</span>
    </div>
  );
}

// ─── Market Simulation Card ───────────────────────────────────────────────────
function SimMarketCard({
  market, selected, onSelect, onBuy,
}: {
  market: SimMarket;
  selected: boolean;
  onSelect: () => void;
  onBuy: (side: "Yes" | "No", amount: number) => void;
}) {
  const yesPct = Math.round(market.currentPrice * 100);
  const noPct = 100 - yesPct;
  const last = market.history[market.history.length - 1]?.p ?? market.currentPrice;
  const prev = market.history[market.history.length - 5]?.p ?? last;
  const delta = last - prev;
  const trending = Math.abs(delta) > 0.005;

  return (
    <div
      onClick={onSelect}
      className={cn(
        "group relative flex flex-col gap-3 rounded-xl border bg-card p-4 cursor-pointer transition-all",
        selected ? "border-brand/60 shadow-lg shadow-brand/10" : "border-border hover:border-border/80"
      )}
    >
      {/* Live indicator */}
      <span className="absolute top-3 right-3 flex items-center gap-1">
        <span className="h-1.5 w-1.5 rounded-full bg-yes animate-pulse" />
        <span className="text-[10px] text-muted-foreground font-mono">LIVE</span>
      </span>

      {/* Header */}
      <div className="flex items-start gap-2 pr-10">
        <span className="text-xl shrink-0 mt-0.5">{market.icon}</span>
        <p className="text-sm font-medium leading-snug text-foreground line-clamp-2">
          {market.question}
        </p>
      </div>

      {/* Mini sparkline */}
      <div className="h-12 -mx-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={market.history.slice(-40)} margin={{ top: 2, bottom: 2, left: 0, right: 0 }}>
            <defs>
              <linearGradient id={`grad-${market.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={delta >= 0 ? "#22c55e" : "#ef4444"} stopOpacity={0.25} />
                <stop offset="95%" stopColor={delta >= 0 ? "#22c55e" : "#ef4444"} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone" dataKey="p" stroke={delta >= 0 ? "#22c55e" : "#ef4444"}
              strokeWidth={1.5} fill={`url(#grad-${market.id})`} dot={false} isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Prob bar */}
      <div className="space-y-1">
        <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-secondary">
          <div className="h-full bg-yes transition-all duration-700" style={{ width: `${yesPct}%` }} />
        </div>
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-1">
            <span className="text-xs font-bold text-yes">{yesPct}%</span>
            {trending && (
              delta > 0
                ? <ArrowUpRight className="h-3 w-3 text-yes" />
                : <ArrowDownRight className="h-3 w-3 text-no" />
            )}
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <BarChart2 className="h-3 w-3" />
            {formatSimVolume(market.volume)}
          </div>
        </div>
      </div>

      {/* Buy buttons */}
      <div className="flex gap-2">
        <button
          onClick={(e) => { e.stopPropagation(); onBuy("Yes", 50); }}
          className="flex-1 rounded-lg py-1.5 text-xs font-semibold bg-yes/10 text-yes hover:bg-yes/20 border border-yes/20 transition-colors"
        >
          Buy Yes ${(yesPct / 100).toFixed(2)}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onBuy("No", 50); }}
          className="flex-1 rounded-lg py-1.5 text-xs font-semibold bg-no/10 text-no hover:bg-no/20 border border-no/20 transition-colors"
        >
          Buy No ${(noPct / 100).toFixed(2)}
        </button>
      </div>
    </div>
  );
}

// ─── Main Simulate Page ───────────────────────────────────────────────────────
export default function SimulatePage() {
  const [markets, setMarkets] = useState<SimMarket[]>([]);
  const [portfolio, setPortfolio] = useState<SimPortfolio>(createPortfolio());
  const [running, setRunning] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tickCount, setTickCount] = useState(0);
  const [tradeLog, setTradeLog] = useState<{ msg: string; time: string; type: "buy" | "sell" | "info" }[]>([]);
  const [tradeAmount, setTradeAmount] = useState(50);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  // Init on mount
  useEffect(() => {
    const m = generateSimMarkets(12);
    setMarkets(m);
    setSelectedId(m[0]?.id ?? null);
    addLog("Simulation initialized. 12 markets generated.", "info");
  }, []);

  // Auto-scroll log
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [tradeLog]);

  const addLog = (msg: string, type: "buy" | "sell" | "info") => {
    const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    setTradeLog((prev) => [...prev.slice(-80), { msg, time, type }]);
  };

  // Tick loop
  const tick = useCallback(() => {
    setMarkets((prev) => {
      const updated = prev.map((m) => tickMarket(m));
      // Log notable moves
      updated.forEach((m, i) => {
        const old = prev[i];
        const delta = Math.abs(m.currentPrice - old.currentPrice);
        if (delta > 0.02) {
          const dir = m.currentPrice > old.currentPrice ? "jumped" : "dropped";
          addLog(
            `${m.icon} "${m.question.slice(0, 40)}..." ${dir} to ${Math.round(m.currentPrice * 100)}%`,
            "info"
          );
        }
        const newTrades = m.trades.slice(old.trades.length);
        newTrades.forEach((t) => {
          if (t.size > 800) {
            addLog(`Large ${t.side} trade: $${t.size} @ $${t.price.toFixed(2)} by ${t.trader}`, t.side === "Yes" ? "buy" : "sell");
          }
        });
      });
      return updated;
    });
    setTickCount((c) => c + 1);
  }, []);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(tick, TICK_INTERVAL_MS);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running, tick]);

  const handleReset = () => {
    setRunning(false);
    const m = generateSimMarkets(12);
    setMarkets(m);
    setSelectedId(m[0]?.id ?? null);
    setPortfolio(createPortfolio());
    setTickCount(0);
    setTradeLog([]);
    addLog("Simulation reset. New markets generated.", "info");
  };

  const handleBuy = useCallback((marketId: string, side: "Yes" | "No", amount: number) => {
    const market = markets.find((m) => m.id === marketId);
    if (!market) return;
    const { portfolio: newPortfolio, error } = placeTrade(portfolio, market, side, amount);
    if (error) {
      addLog(`Trade failed: ${error}`, "info");
      return;
    }
    setPortfolio(newPortfolio);
    const price = side === "Yes" ? market.currentPrice : 1 - market.currentPrice;
    addLog(`You bought ${side} $${amount} @ $${price.toFixed(2)} — "${market.question.slice(0, 35)}..."`, side === "Yes" ? "buy" : "sell");
  }, [markets, portfolio]);

  const selectedMarket = markets.find((m) => m.id === selectedId);
  const pnl = calcPortfolioPnL(portfolio, markets);
  const totalPositions = Object.keys(portfolio.positions).length;

  return (
    <div className="min-h-screen bg-background">
      <Header activeCategory="" />

      <main className="mx-auto max-w-[1600px] px-3 py-4">
        {/* ── Page header ───────────────────────────────────────────────── */}
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand/10 border border-brand/20">
              <FlaskConical className="h-5 w-5 text-brand" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">Market Simulator</h1>
              <p className="text-xs text-muted-foreground">
                Auto-generated markets with live price simulation — no real money involved
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground border border-border rounded-md px-2 py-1">
              Tick #{tickCount}
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={handleReset}
              className="gap-1.5 border-border text-muted-foreground hover:text-foreground"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Reset
            </Button>
            <Button
              size="sm"
              onClick={() => setRunning((r) => !r)}
              className={cn(
                "gap-1.5 font-semibold",
                running
                  ? "bg-no/10 text-no border border-no/30 hover:bg-no/20"
                  : "bg-yes/10 text-yes border border-yes/30 hover:bg-yes/20"
              )}
            >
              {running ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              {running ? "Pause" : "Run Simulation"}
            </Button>
          </div>
        </div>

        {/* ── Portfolio stats bar ───────────────────────────────────────── */}
        <div className="mb-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: "Balance", value: `$${portfolio.balance.toFixed(2)}`, icon: DollarSign, color: "text-foreground" },
            { label: "Unrealized PnL", value: `${pnl >= 0 ? "+" : ""}$${pnl.toFixed(2)}`, icon: pnl >= 0 ? TrendingUp : TrendingDown, color: pnl >= 0 ? "text-yes" : "text-no" },
            { label: "Open Positions", value: String(totalPositions), icon: Activity, color: "text-brand" },
            { label: "Your Trades", value: String(portfolio.trades.length), icon: Zap, color: "text-yellow-400" },
          ].map((stat) => (
            <div key={stat.label} className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
              <stat.icon className={cn("h-5 w-5 shrink-0", stat.color)} />
              <div>
                <p className="text-[11px] text-muted-foreground">{stat.label}</p>
                <p className={cn("text-base font-bold font-mono", stat.color)}>{stat.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Main 3-column layout ──────────────────────────────────────── */}
        <div className="flex gap-3">

          {/* Left: market grid */}
          <div className="flex-1 min-w-0">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">
                Simulated Markets
                <Badge variant="outline" className="ml-2 font-mono text-[10px] border-border text-muted-foreground">
                  {markets.length} active
                </Badge>
              </h2>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-yes animate-pulse inline-block" />
                  {running ? "Updating every 1.2s" : "Paused"}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {markets.map((market) => (
                <SimMarketCard
                  key={market.id}
                  market={market}
                  selected={selectedId === market.id}
                  onSelect={() => setSelectedId(market.id)}
                  onBuy={(side, amount) => handleBuy(market.id, side, tradeAmount)}
                />
              ))}
            </div>
          </div>

          {/* Right: detail + log */}
          <div className="hidden lg:flex lg:w-80 xl:w-96 shrink-0 flex-col gap-3">

            {/* Selected market detail */}
            {selectedMarket && (
              <div className="rounded-xl border border-border bg-card p-4 space-y-4">
                <div className="flex items-start gap-2">
                  <span className="text-2xl shrink-0">{selectedMarket.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground leading-snug">{selectedMarket.question}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{selectedMarket.description}</p>
                  </div>
                </div>

                {/* Full chart */}
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={selectedMarket.history.slice(-80)} margin={{ top: 4, bottom: 4, left: 0, right: 0 }}>
                      <defs>
                        <linearGradient id="sel-grad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="t" hide />
                      <YAxis domain={[0, 1]} hide />
                      <Tooltip content={<ChartTooltip />} />
                      <ReferenceLine y={0.5} stroke="#334155" strokeDasharray="3 3" />
                      <Area
                        type="monotone" dataKey="p" stroke="#3b82f6" strokeWidth={2}
                        fill="url(#sel-grad)" dot={false} isAnimationActive={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-2 text-xs">
                  {[
                    { label: "Yes", value: `${Math.round(selectedMarket.currentPrice * 100)}%`, color: "text-yes" },
                    { label: "Volume", value: formatSimVolume(selectedMarket.volume), color: "text-foreground" },
                    { label: "Traders", value: selectedMarket.traders.toLocaleString(), color: "text-brand" },
                  ].map((s) => (
                    <div key={s.label} className="rounded-lg bg-secondary px-2 py-2 text-center">
                      <p className="text-muted-foreground text-[10px]">{s.label}</p>
                      <p className={cn("font-bold font-mono mt-0.5", s.color)}>{s.value}</p>
                    </div>
                  ))}
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-1.5">
                  {selectedMarket.tags.map((tag) => (
                    <span key={tag} className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">
                      {tag}
                    </span>
                  ))}
                </div>

                {/* Trade panel */}
                <div className="space-y-2 border-t border-border pt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground">Place Trade</span>
                    <span className="text-xs text-muted-foreground font-mono">Balance: ${portfolio.balance.toFixed(0)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Amount $</span>
                    <input
                      type="number"
                      min={1}
                      max={portfolio.balance}
                      value={tradeAmount}
                      onChange={(e) => setTradeAmount(Number(e.target.value))}
                      className="flex-1 rounded-lg border border-border bg-secondary px-3 py-1.5 text-sm font-mono text-foreground outline-none focus:border-brand/50"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleBuy(selectedMarket.id, "Yes", tradeAmount)}
                      className="flex-1 rounded-lg py-2 text-xs font-bold bg-yes/10 text-yes hover:bg-yes/20 border border-yes/20 transition-colors"
                    >
                      Buy Yes @ ${selectedMarket.currentPrice.toFixed(2)}
                    </button>
                    <button
                      onClick={() => handleBuy(selectedMarket.id, "No", tradeAmount)}
                      className="flex-1 rounded-lg py-2 text-xs font-bold bg-no/10 text-no hover:bg-no/20 border border-no/20 transition-colors"
                    >
                      Buy No @ ${(1 - selectedMarket.currentPrice).toFixed(2)}
                    </button>
                  </div>
                </div>

                {/* Recent trades */}
                <div className="border-t border-border pt-3 space-y-1">
                  <p className="text-xs font-semibold text-foreground mb-2">Recent Trades</p>
                  {selectedMarket.trades.slice(-6).reverse().map((t) => (
                    <div key={t.id} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className={cn("font-semibold", t.side === "Yes" ? "text-yes" : "text-no")}>{t.side}</span>
                        <span className="text-muted-foreground">{t.trader}</span>
                      </div>
                      <div className="flex items-center gap-2 font-mono">
                        <span className="text-muted-foreground">${t.size}</span>
                        <span className={cn(t.side === "Yes" ? "text-yes" : "text-no")}>${t.price.toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Activity log */}
            <div className="rounded-xl border border-border bg-card p-4 flex-1">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Activity className="h-3.5 w-3.5 text-brand" />
                  Activity Log
                </p>
                <button onClick={() => setTradeLog([])} className="text-[10px] text-muted-foreground hover:text-foreground">
                  Clear
                </button>
              </div>
              <div ref={logRef} className="space-y-1.5 max-h-72 overflow-y-auto no-scrollbar">
                {tradeLog.length === 0 && (
                  <p className="text-xs text-muted-foreground">Press &ldquo;Run Simulation&rdquo; to start</p>
                )}
                {tradeLog.map((entry, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <span className="shrink-0 font-mono text-[10px] text-muted-foreground mt-0.5">{entry.time}</span>
                    <span className={cn(
                      entry.type === "buy" ? "text-yes" : entry.type === "sell" ? "text-no" : "text-muted-foreground"
                    )}>
                      {entry.msg}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
