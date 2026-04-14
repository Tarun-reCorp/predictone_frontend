"use client";

import { useState } from "react";
import Link from "next/link";
import { Newspaper, MessageCircle, Star, ChevronRight, Dot } from "lucide-react";
import { type PolyMarket, parseOutcomePrices } from "@/lib/polymarket";
import { cn } from "@/lib/utils";

// Breaking News panel
const MOCK_NEWS = [
  {
    id: "1",
    headline: "Federal Reserve signals potential rate cuts in Q3 amid cooling inflation data",
    time: "5m ago",
    urgent: true,
  },
  {
    id: "2",
    headline: "Middle East tensions escalate as diplomatic talks stall in Geneva",
    time: "12m ago",
    urgent: true,
  },
  {
    id: "3",
    headline: "Tech giants face new EU antitrust regulations targeting AI platforms",
    time: "28m ago",
    urgent: false,
  },
  {
    id: "4",
    headline: "Presidential polling shows unprecedented volatility in swing states",
    time: "1h ago",
    urgent: false,
  },
];

export function BreakingNews() {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          <Newspaper className="h-3.5 w-3.5 text-no" />
          <h3 className="text-sm font-semibold text-foreground">Breaking News</h3>
        </div>
        <div className="flex gap-2">
          <button className="text-muted-foreground hover:text-foreground transition-colors">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <circle cx="11" cy="11" r="8" strokeWidth={2} />
              <path d="m21 21-4.35-4.35" strokeWidth={2} />
            </svg>
          </button>
          <button className="text-muted-foreground hover:text-foreground transition-colors">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <circle cx="12" cy="12" r="1" fill="currentColor" />
              <circle cx="19" cy="12" r="1" fill="currentColor" />
              <circle cx="5" cy="12" r="1" fill="currentColor" />
            </svg>
          </button>
        </div>
      </div>
      <div className="divide-y divide-border/30">
        {MOCK_NEWS.map((item) => (
          <div
            key={item.id}
            className="flex items-start gap-2.5 px-4 py-3 hover:bg-secondary/30 transition-colors cursor-pointer"
          >
            <Dot
              className={cn(
                "mt-0.5 h-5 w-5 shrink-0",
                item.urgent ? "text-no" : "text-muted-foreground/40"
              )}
            />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-foreground leading-relaxed line-clamp-2">{item.headline}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{item.time}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Community Comments
const MOCK_COMMENTS = [
  {
    id: "1",
    user: "donanwkaron",
    badge: "Bullish",
    text: "regulation in tom one ecrene",
    change: "+53%",
    positive: true,
    tags: ["Bullish", "Bearish", "Neutral"],
  },
  {
    id: "2",
    user: "barselha",
    badge: "Gold",
    text: "is commend",
    change: "-64%",
    positive: false,
    tags: ["Bearish", "Bearish"],
  },
  {
    id: "3",
    user: "Koe tasthol",
    badge: null,
    text: "A commened",
    change: "-45%",
    positive: false,
    tags: ["Bullish", "Bearish"],
  },
];

export function CommunityComments() {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50">
        <MessageCircle className="h-3.5 w-3.5 text-brand" />
        <h3 className="text-sm font-semibold text-foreground">Top Community Comments</h3>
      </div>
      <div className="divide-y divide-border/30">
        {MOCK_COMMENTS.map((comment) => (
          <div key={comment.id} className="px-4 py-3 space-y-1.5 hover:bg-secondary/30 transition-colors cursor-pointer">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-full bg-secondary flex items-center justify-center text-xs font-bold text-foreground">
                  {comment.user.charAt(0).toUpperCase()}
                </div>
                <span className="text-xs font-semibold text-foreground">{comment.user}</span>
                {comment.badge && (
                  <span className="rounded bg-brand/10 border border-brand/20 px-1.5 py-0.5 text-xs text-brand">{comment.badge}</span>
                )}
              </div>
              <span className={cn("text-xs font-bold font-mono", comment.positive ? "text-yes" : "text-no")}>
                {comment.change}
              </span>
            </div>
            <p className="text-xs text-muted-foreground pl-8">{comment.text}</p>
            <div className="flex gap-1.5 pl-8">
              {comment.tags.map((tag, i) => (
                <span
                  key={i}
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-xs font-medium",
                    tag === "Bullish"
                      ? "bg-yes/10 border-yes/20 text-yes"
                      : tag === "Bearish"
                      ? "bg-no/10 border-no/20 text-no"
                      : "bg-secondary border-border text-muted-foreground"
                  )}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Watchlist
interface WatchlistProps {
  markets: PolyMarket[];
}

export function Watchlist({ markets }: WatchlistProps) {
  const [pinned] = useState(() => markets.slice(0, 3));

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          <Star className="h-3.5 w-3.5 text-yellow-400" />
          <h3 className="text-sm font-semibold text-foreground">Watchlist</h3>
        </div>
        <button className="text-xs text-brand hover:underline">+ Add</button>
      </div>
      {pinned.length > 0 ? (
        <div className="p-3 grid grid-cols-3 gap-2">
          {pinned.map((m) => {
            const prices = parseOutcomePrices(m.outcomePrices);
            const yesPct = Math.round((prices[0] ?? 0.5) * 100);
            return (
              <Link
                key={m.conditionId}
                href={`/market/${m.conditionId}`}
                className="flex flex-col gap-1.5 rounded-lg border border-border bg-secondary/50 p-2.5 hover:border-primary/30 transition-colors"
              >
                <p className="text-xs text-muted-foreground line-clamp-1">Mini Charts</p>
                <div className="h-8 flex items-end gap-px">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-sm bg-brand/60"
                      style={{ height: `${20 + Math.sin(i) * 15 + yesPct * 0.2}%` }}
                    />
                  ))}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-yes">{yesPct}%</span>
                  <button className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                    Quick-trade
                  </button>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="px-4 py-6 text-center">
          <p className="text-xs text-muted-foreground">Pin up to 4 detailed charts.</p>
        </div>
      )}
    </div>
  );
}
