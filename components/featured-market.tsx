"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { TrendingUp, TrendingDown, BarChart2, Loader2 } from "lucide-react";
import {
  type PolyMarket,
  type PriceHistory,
  parseOutcomes,
  parseOutcomePrices,
  formatVolume,
  clientFetchPriceHistory,
} from "@/lib/polymarket";
import { cn } from "@/lib/utils";

interface FeaturedMarketProps {
  market: PolyMarket;
  priceHistory?: PriceHistory[]; // optional initial data (ignored — component self-fetches)
}

const INTERVALS = ["1H", "1D", "1W", "1M", "ALL"] as const;
type Interval = (typeof INTERVALS)[number];

// Map UI label → CLOB API interval value
const INTERVAL_API: Record<Interval, string> = {
  "1H":  "1h",
  "1D":  "1d",
  "1W":  "1w",
  "1M":  "1m",
  "ALL": "max",
};

// Fidelity (data-point density) per interval
const INTERVAL_FIDELITY: Record<Interval, number> = {
  "1H":  1,
  "1D":  10,
  "1W":  60,
  "1M":  60,
  "ALL": 60,
};

function formatDate(timestamp: number, interval: Interval) {
  const d = new Date(timestamp * 1000);
  if (interval === "1H") return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (interval === "1D") return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export function FeaturedMarket({ market }: FeaturedMarketProps) {
  const [interval, setInterval] = useState<Interval>("1W");
  const [history, setHistory]   = useState<PriceHistory[]>([]);
  const [chartLoading, setChartLoading] = useState(false);

  const [tradeType, setTradeType] = useState<"yes" | "no">("yes");
  const [quantity, setQuantity]   = useState("100");

  const outcomes  = parseOutcomes(market.outcomes);
  const prices    = parseOutcomePrices(market.outcomePrices);
  const yesPrice  = prices[0] ?? 0.5;
  const yesPct    = Math.round(yesPrice * 100);

  // Extract clobTokenId[0] — this is what the CLOB prices-history API needs
  const tokenId = useMemo(() => {
    try {
      const ids: string[] = JSON.parse(market.clobTokenIds ?? "[]");
      return ids[0] ?? null;
    } catch {
      return null;
    }
  }, [market.clobTokenIds]);

  // Fetch price history whenever the token or interval changes
  useEffect(() => {
    if (!tokenId) return;
    let cancelled = false;

    setChartLoading(true);
    clientFetchPriceHistory(tokenId, INTERVAL_API[interval])
      .then((data) => { if (!cancelled) setHistory(data); })
      .catch(() => { if (!cancelled) setHistory([]); })
      .finally(() => { if (!cancelled) setChartLoading(false); });

    return () => { cancelled = true; };
  }, [tokenId, interval]);

  const chartData = history.slice(-200).map((p) => ({
    time:  formatDate(p.t, interval),
    price: Math.round(p.p * 100),
  }));

  const firstPrice  = chartData[0]?.price ?? yesPct;
  const lastPrice   = chartData[chartData.length - 1]?.price ?? yesPct;
  const priceChange = lastPrice - firstPrice;
  const isPositive  = priceChange >= 0;

  const estimatedPayout =
    parseFloat(quantity) > 0
      ? (parseFloat(quantity) / (tradeType === "yes" ? yesPrice : 1 - yesPrice)).toFixed(2)
      : "0.00";

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 p-4 pb-3 border-b border-border/50">
        <div className="flex items-start gap-3">
          {market.image && (
            <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-border">
              <Image src={market.image} alt="" fill className="object-cover" sizes="48px" />
            </div>
          )}
          <div>
            <Link
              href={`/market/${market.slug || market.id}`}
              className="font-semibold text-foreground hover:text-primary/90 transition-colors leading-snug line-clamp-2"
            >
              {market.question}
            </Link>
            <div className="mt-1 flex items-center gap-2">
              <div className={cn("flex items-center gap-1 text-sm font-bold", isPositive ? "text-yes" : "text-no")}>
                {isPositive ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                <span>{yesPct}%</span>
                <span className="text-xs font-normal opacity-80">
                  {isPositive ? "+" : ""}{priceChange}pts
                </span>
              </div>
              <span className="text-muted-foreground text-xs">·</span>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <BarChart2 className="h-3 w-3" />
                {formatVolume(market.volumeNum ?? market.volume)}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-border/50">
        {/* Chart */}
        <div className="lg:col-span-2 p-4">
          {/* Interval selector */}
          <div className="flex items-center gap-1 mb-3">
            {INTERVALS.map((iv) => (
              <button
                key={iv}
                onClick={() => setInterval(iv)}
                className={cn(
                  "rounded px-2 py-1 text-xs font-medium transition-colors",
                  interval === iv
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {iv}
              </button>
            ))}
          </div>

          {/* Chart area */}
          {chartLoading ? (
            <div className="flex h-[180px] items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : chartData.length > 1 ? (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="yesGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="oklch(0.65 0.18 145)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="oklch(0.65 0.18 145)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.22 0.008 240)" />
                <XAxis
                  dataKey="time"
                  tick={{ fill: "oklch(0.55 0.01 240)", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fill: "oklch(0.55 0.01 240)", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  domain={[0, 100]}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip
                  contentStyle={{
                    background: "oklch(0.16 0.006 240)",
                    border: "1px solid oklch(0.22 0.008 240)",
                    borderRadius: "8px",
                    color: "oklch(0.95 0.005 240)",
                    fontSize: 12,
                  }}
                  formatter={(value: number) => [`${value}%`, "Yes"]}
                />
                <Area
                  type="monotone"
                  dataKey="price"
                  stroke="oklch(0.65 0.18 145)"
                  strokeWidth={2}
                  fill="url(#yesGradient)"
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[180px] flex-col items-center justify-center gap-1.5">
              <p className="text-sm text-muted-foreground">No price history available</p>
              {!tokenId && (
                <p className="text-xs text-muted-foreground/60">Market has no CLOB token</p>
              )}
            </div>
          )}
        </div>

        {/* Trade panel */}
        <div className="p-4 flex flex-col gap-3">
          <p className="text-sm font-semibold text-foreground">Place Order</p>

          {/* Yes/No toggle */}
          <div className="grid grid-cols-2 gap-1.5 rounded-lg bg-secondary p-1">
            <button
              onClick={() => setTradeType("yes")}
              className={cn(
                "rounded-md py-2 text-sm font-semibold transition-all",
                tradeType === "yes"
                  ? "bg-yes text-primary-foreground shadow"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Yes {yesPct}¢
            </button>
            <button
              onClick={() => setTradeType("no")}
              className={cn(
                "rounded-md py-2 text-sm font-semibold transition-all",
                tradeType === "no"
                  ? "bg-no text-primary-foreground shadow"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              No {100 - yesPct}¢
            </button>
          </div>

          {/* Amount input */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Amount (USDC)</label>
            <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary px-3 py-2">
              <span className="text-sm text-muted-foreground font-mono">$</span>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="flex-1 bg-transparent text-sm font-mono text-foreground outline-none"
                min="1"
                placeholder="100"
              />
            </div>
          </div>

          {/* Quick amounts */}
          <div className="flex gap-1.5">
            {["10", "50", "100", "500"].map((amt) => (
              <button
                key={amt}
                onClick={() => setQuantity(amt)}
                className={cn(
                  "flex-1 rounded-md py-1 text-xs font-medium transition-colors border",
                  quantity === amt
                    ? "border-primary/50 bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground hover:border-border/80"
                )}
              >
                ${amt}
              </button>
            ))}
          </div>

          {/* Payout estimate */}
          <div className="rounded-lg bg-secondary/50 p-3 space-y-1.5 border border-border/50">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Avg price</span>
              <span className="font-mono text-foreground">
                {tradeType === "yes" ? `${yesPct}¢` : `${100 - yesPct}¢`}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Potential payout</span>
              <span className="font-mono font-semibold text-yes">${estimatedPayout}</span>
            </div>
          </div>

          {/* Buy button */}
          <button
            className={cn(
              "w-full rounded-lg py-2.5 text-sm font-bold transition-all",
              tradeType === "yes"
                ? "bg-yes hover:bg-yes/90 text-primary-foreground"
                : "bg-no hover:bg-no/90 text-primary-foreground"
            )}
          >
            Buy {tradeType === "yes" ? "Yes" : "No"} — ${quantity || "0"}
          </button>

          <p className="text-center text-xs text-muted-foreground">Connect wallet to trade</p>
        </div>
      </div>
    </div>
  );
}
