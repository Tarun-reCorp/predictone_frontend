"use client";

import Link from "next/link";
import Image from "next/image";
import { TrendingUp, Users, BarChart2 } from "lucide-react";
import { type PolyMarket, parseOutcomes, parseOutcomePrices, formatVolume } from "@/lib/polymarket";
import { cn } from "@/lib/utils";

interface MarketCardProps {
  market: PolyMarket;
}

export function MarketCard({ market }: MarketCardProps) {
  const outcomes = parseOutcomes(market.outcomes);
  const prices = parseOutcomePrices(market.outcomePrices);
  const yesPrice = prices[0] ?? 0.5;
  const noPrice = prices[1] ?? 0.5;
  const yesPct = Math.round(yesPrice * 100);
  const noPct = Math.round(noPrice * 100);

  const isYesLeading = yesPrice >= noPrice;

  return (
    <Link
      href={`/market/${market.slug || market.id}`}
      className="group flex flex-col gap-3 rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/30 hover:bg-card/80 hover:shadow-lg hover:shadow-black/20"
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        {market.image && (
          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-border">
            <Image
              src={market.image}
              alt=""
              fill
              className="object-cover"
              sizes="40px"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          </div>
        )}
        <p className="flex-1 text-sm font-medium leading-snug text-foreground line-clamp-2 group-hover:text-primary/90 transition-colors">
          {market.question}
        </p>
      </div>

      {/* Yes/No probability bar */}
      <div className="space-y-1.5">
        <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full bg-yes transition-all duration-500"
            style={{ width: `${yesPct}%` }}
          />
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-yes">{yesPct}%</span>
            <span className="text-xs text-muted-foreground">Yes</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">No</span>
            <span className="text-xs font-bold text-no">{noPct}%</span>
          </div>
        </div>
      </div>

      {/* Buy buttons */}
      <div className="flex gap-2">
        <button
          onClick={(e) => e.preventDefault()}
          className={cn(
            "flex-1 rounded-lg py-1.5 text-xs font-semibold transition-all",
            "bg-yes/10 text-yes hover:bg-yes/20 border border-yes/20"
          )}
        >
          Buy Yes {yesPct}¢
        </button>
        <button
          onClick={(e) => e.preventDefault()}
          className={cn(
            "flex-1 rounded-lg py-1.5 text-xs font-semibold transition-all",
            "bg-no/10 text-no hover:bg-no/20 border border-no/20"
          )}
        >
          Buy No {noPct}¢
        </button>
      </div>

      {/* Footer stats */}
      <div className="flex items-center justify-between border-t border-border/50 pt-2.5">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <BarChart2 className="h-3 w-3" />
          <span>{formatVolume(market.volumeNum ?? market.volume)}</span>
          <span className="text-border">·</span>
          <span>Vol</span>
        </div>
        {market.tags && market.tags.length > 0 && (
          <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
            {market.tags[0].label}
          </span>
        )}
      </div>
    </Link>
  );
}

export function MarketCardSkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 animate-pulse">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-lg bg-secondary shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-3.5 rounded bg-secondary w-full" />
          <div className="h-3.5 rounded bg-secondary w-3/4" />
        </div>
      </div>
      <div className="h-1.5 rounded-full bg-secondary" />
      <div className="flex gap-2">
        <div className="flex-1 h-7 rounded-lg bg-secondary" />
        <div className="flex-1 h-7 rounded-lg bg-secondary" />
      </div>
      <div className="h-px bg-border/50" />
      <div className="h-3 w-24 rounded bg-secondary" />
    </div>
  );
}
