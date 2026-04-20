"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { TrendingUp, Activity, Star, Dot, Loader2, BarChart3 } from "lucide-react";
import {
  type PolyMarket,
  parseOutcomePrices,
  formatVolume,
  clientFetchMarkets,
} from "@/lib/polymarket";
import { cn } from "@/lib/utils";

// Trending Markets — real data from Polymarket (top by volume)
export function BreakingNews() {
  const [markets, setMarkets] = useState<PolyMarket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    clientFetchMarkets({ limit: 6, active: true, order: "volume", ascending: false })
      .then((data) => setMarkets(data.slice(0, 6)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-3.5 w-3.5 text-brand" />
          <h3 className="text-sm font-semibold text-foreground">Trending Markets</h3>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : markets.length === 0 ? (
        <div className="px-4 py-6 text-center">
          <p className="text-xs text-muted-foreground">No markets available</p>
        </div>
      ) : (
        <div className="divide-y divide-border/30">
          {markets.map((m) => {
            const prices = parseOutcomePrices(m.outcomePrices);
            const yesPct = Math.round((prices[0] ?? 0.5) * 100);
            const vol = m.volumeNum ?? m.volume ?? 0;
            const hasVolume = vol > 0;
            const isHot = vol > 100000;
            return (
              <Link
                key={m.conditionId || m.id}
                href={`/market/${m.slug || m.conditionId}`}
                className="flex items-start gap-2.5 px-4 py-3 hover:bg-secondary/30 transition-colors"
              >
                <Dot
                  className={cn(
                    "mt-0.5 h-5 w-5 shrink-0",
                    isHot ? "text-no" : "text-muted-foreground/40"
                  )}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-foreground leading-relaxed line-clamp-2">
                    {m.question}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    {hasVolume ? (
                      <span className="text-[10px] font-mono font-bold text-yes">
                        Yes {yesPct}%
                      </span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">
                        No trades yet
                      </span>
                    )}
                    <span className="text-[10px] text-muted-foreground">
                      {formatVolume(vol)} vol
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Recently Active Markets — sorted by newest
export function CommunityComments() {
  const [markets, setMarkets] = useState<PolyMarket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    clientFetchMarkets({ limit: 5, active: true, order: "startDate", ascending: false })
      .then((data) => setMarkets(data.slice(0, 5)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50">
        <Activity className="h-3.5 w-3.5 text-brand" />
        <h3 className="text-sm font-semibold text-foreground">New Markets</h3>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : markets.length === 0 ? (
        <div className="px-4 py-6 text-center">
          <p className="text-xs text-muted-foreground">No new markets</p>
        </div>
      ) : (
        <div className="divide-y divide-border/30">
          {markets.map((m) => {
            const prices = parseOutcomePrices(m.outcomePrices);
            const yesPct = Math.round((prices[0] ?? 0.5) * 100);
            const noPct = 100 - yesPct;
            const vol = m.volumeNum ?? m.volume ?? 0;
            const hasVolume = vol > 0;
            return (
              <Link
                key={m.conditionId || m.id}
                href={`/market/${m.slug || m.conditionId}`}
                className="px-4 py-3 block hover:bg-secondary/30 transition-colors"
              >
                <p className="text-xs text-foreground leading-relaxed line-clamp-2">
                  {m.question}
                </p>
                <div className="flex items-center gap-2 mt-1.5">
                  {hasVolume ? (
                    <>
                      <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden flex">
                        <div className="h-full bg-yes rounded-l-full" style={{ width: `${yesPct}%` }} />
                        <div className="h-full bg-no rounded-r-full" style={{ width: `${noPct}%` }} />
                      </div>
                      <span className="text-[10px] font-mono font-bold text-yes shrink-0">{yesPct}%</span>
                    </>
                  ) : (
                    <>
                      <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                        <div className="h-full w-1/2 bg-muted-foreground/20" />
                      </div>
                      <span className="text-[10px] text-muted-foreground shrink-0">New</span>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1">
                  <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <BarChart3 className="h-2.5 w-2.5" />
                    {hasVolume ? `${formatVolume(vol)} vol` : "$0 liq"}
                  </span>
                  {m.new && (
                    <span className="rounded-full bg-brand/15 border border-brand/20 px-1.5 py-0.5 text-[10px] font-semibold text-brand">
                      New
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
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
            const vol = m.volumeNum ?? m.volume ?? 0;
            const hasVolume = vol > 0;
            return (
              <Link
                key={m.conditionId || m.id}
                href={`/market/${m.slug || m.conditionId}`}
                className="flex flex-col gap-1.5 rounded-lg border border-border bg-secondary/50 p-2.5 hover:border-primary/30 transition-colors"
              >
                <p className="text-xs text-muted-foreground line-clamp-1">Mini Charts</p>
                <div className="h-8 flex items-end gap-px">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-sm bg-brand/60"
                      style={{ height: `${20 + Math.sin(i) * 15 + (hasVolume ? yesPct : 50) * 0.2}%` }}
                    />
                  ))}
                </div>
                <div className="flex items-center justify-between">
                  {hasVolume ? (
                    <span className="text-xs font-mono font-bold text-yes">{yesPct}%</span>
                  ) : (
                    <span className="text-[10px] text-muted-foreground">No trades</span>
                  )}
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
