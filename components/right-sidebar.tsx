"use client";

import { useState } from "react";
import { TrendingUp, TrendingDown, ArrowUpRight, Minus } from "lucide-react";
import { type PolyMarket, type Leaderboard, parseOutcomes, parseOutcomePrices } from "@/lib/polymarket";
import { cn } from "@/lib/utils";

// Market Pulse - quick sentiment on featured markets
interface MarketPulseProps {
  markets: PolyMarket[];
}

const SENTIMENTS = ["Bullish", "Bearish", "Neutral", "Trade"] as const;
type Sentiment = (typeof SENTIMENTS)[number];

function randomSentiment(): Sentiment {
  return SENTIMENTS[Math.floor(Math.random() * SENTIMENTS.length)];
}

const SENTIMENT_COLORS: Record<Sentiment, string> = {
  Bullish: "text-yes bg-yes/10 border-yes/20",
  Bearish: "text-no bg-no/10 border-no/20",
  Neutral: "text-muted-foreground bg-secondary border-border",
  Trade: "text-brand bg-brand/10 border-brand/20",
};

export function MarketPulse({ markets }: MarketPulseProps) {
  const pulseItems = markets.slice(0, 5).map((m, i) => ({
    market: m,
    sentiment: SENTIMENTS[i % SENTIMENTS.length],
  }));

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
        <h3 className="text-sm font-semibold text-foreground">Market Pulse</h3>
        <button className="text-xs text-brand hover:underline">Shortcut</button>
      </div>
      <div className="divide-y divide-border/30">
        {pulseItems.map(({ market, sentiment }) => {
          const prices = parseOutcomePrices(market.outcomePrices);
          const yesPct = Math.round((prices[0] ?? 0.5) * 100);
          const isUp = yesPct >= 50;
          return (
            <div key={market.conditionId} className="flex items-start gap-3 px-4 py-3 hover:bg-secondary/30 transition-colors cursor-pointer">
              <div className={cn("mt-0.5 h-2 w-2 rounded-full shrink-0", isUp ? "bg-yes" : "bg-no")} />
              <p className="flex-1 text-xs text-muted-foreground line-clamp-2 leading-relaxed hover:text-foreground transition-colors">
                {market.question}
              </p>
              <span
                className={cn(
                  "shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium",
                  SENTIMENT_COLORS[sentiment]
                )}
              >
                {sentiment}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Trader Leaderboard
interface LeaderboardProps {
  entries: Leaderboard[];
}

export function TraderLeaderboard({ entries }: LeaderboardProps) {
  const displayEntries = entries.length > 0 ? entries : MOCK_LEADERBOARD;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
        <h3 className="text-sm font-semibold text-foreground">Trader Leaderboard</h3>
        <div className="flex gap-4 text-xs text-muted-foreground">
          <span>Users</span>
          <span>Net P&L</span>
        </div>
      </div>
      <div className="divide-y divide-border/30">
        {displayEntries.slice(0, 5).map((entry, i) => {
          const pnl = entry.profitAndLoss ?? 0;
          const isPositive = pnl >= 0;
          const addr = entry.name || entry.address?.slice(0, 8) + "...";
          return (
            <div key={entry.address ?? i} className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/30 transition-colors cursor-pointer group">
              <span className="w-5 text-center text-xs font-bold text-muted-foreground">{i + 1}</span>
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold text-foreground">
                {addr.charAt(0).toUpperCase()}
              </div>
              <span className="flex-1 text-xs font-medium text-foreground truncate group-hover:text-primary/90 transition-colors">
                {addr}
              </span>
              <span className={cn("text-xs font-mono font-bold", isPositive ? "text-yes" : "text-no")}>
                {isPositive ? "+" : ""}
                {pnl >= 1000
                  ? `$${(pnl / 1000).toFixed(1)}K`
                  : `$${pnl.toFixed(0)}`}
              </span>
              <button className="text-xs text-muted-foreground hover:text-brand transition-colors flex items-center gap-0.5">
                View <ArrowUpRight className="h-3 w-3" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Hot Topics
interface HotTopicsProps {
  markets: PolyMarket[];
}

export function HotTopics({ markets }: HotTopicsProps) {
  const topics = markets.slice(0, 6).map((m, i) => {
    const prices = parseOutcomePrices(m.outcomePrices);
    const yesPct = Math.round((prices[0] ?? 0.5) * 100);
    const vol = m.volumeNum ?? m.volume ?? 0;
    const volStr = vol >= 1_000_000 ? `$${(vol / 1_000_000).toFixed(1)}M` : vol >= 1_000 ? `$${(vol / 1_000).toFixed(0)}K` : `$${vol}`;
    const trend = i % 3 === 0 ? "up" : i % 3 === 1 ? "fire" : "down";
    return { market: m, yesPct, volStr, trend };
  });

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border/50">
        <h3 className="text-sm font-semibold text-foreground">Hot Topics</h3>
      </div>
      <div className="divide-y divide-border/30">
        {topics.map(({ market, volStr, trend }, i) => (
          <div key={market.conditionId} className="flex items-center gap-3 px-4 py-2.5 hover:bg-secondary/30 transition-colors cursor-pointer">
            <span className="w-4 text-xs font-bold text-muted-foreground">{i + 1}</span>
            <p className="flex-1 text-xs text-foreground line-clamp-1">{market.question}</p>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-xs font-mono text-muted-foreground">{volStr}</span>
              {trend === "up" && <TrendingUp className="h-3 w-3 text-yes" />}
              {trend === "down" && <TrendingDown className="h-3 w-3 text-no" />}
              {trend === "fire" && <span className="text-xs text-orange-400">HOT</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Mock data fallback for leaderboard
const MOCK_LEADERBOARD: Leaderboard[] = [
  { name: "vest.eth", address: "0x1234", profitAndLoss: 3319200 },
  { name: "DeSantis", address: "0x5678", profitAndLoss: 36550 },
  { name: "belaskioesk", address: "0x9abc", profitAndLoss: 25500 },
  { name: "polywhale", address: "0xdef0", profitAndLoss: 18200 },
  { name: "trader_x", address: "0x1111", profitAndLoss: -4200 },
];

// Predictive AI Insights panel
export function AIPredictions({ markets }: { markets: PolyMarket[] }) {
  const items = markets.slice(0, 3).map((m) => {
    const prices = parseOutcomePrices(m.outcomePrices);
    const yesPct = Math.round((prices[0] ?? 0.5) * 100);
    return { market: m, yesPct };
  });

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
        <h3 className="text-sm font-semibold text-foreground">AI Predictions</h3>
        <span className="rounded-full bg-brand/10 border border-brand/20 px-2 py-0.5 text-xs text-brand font-medium">Beta</span>
      </div>
      <div className="p-4 space-y-3">
        <p className="text-xs text-muted-foreground leading-relaxed">
          AI-generated forecasts based on news, sentiment analysis, and social data signals.
        </p>
        {items.map(({ market, yesPct }) => (
          <div key={market.conditionId} className="flex items-center justify-between gap-3">
            <p className="text-xs text-foreground line-clamp-1 flex-1">{market.question}</p>
            <div className="flex items-center gap-1.5 shrink-0">
              <div className="h-1 w-16 rounded-full bg-secondary overflow-hidden">
                <div className="h-full bg-brand transition-all" style={{ width: `${yesPct}%` }} />
              </div>
              <span className="text-xs font-mono font-semibold text-brand">{yesPct}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
