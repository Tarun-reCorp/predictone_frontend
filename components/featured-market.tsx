"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { TrendingUp, TrendingDown, BarChart2, AlertCircle, Loader2 } from "lucide-react";
import {
  type PolyMarket,
  type PriceHistory,
  parseOutcomePrices,
  formatVolume,
} from "@/lib/polymarket";
import { cn } from "@/lib/utils";

interface FeaturedMarketProps {
  market: PolyMarket;
  priceHistory?: PriceHistory[]; // unused — kept for API compatibility
  onBuy?: (outcome: "Yes" | "No", amount: number) => void;
  isLoggedIn?: boolean;
  isPlacing?: boolean;
  placeError?: string | null;
  tradeType?: "yes" | "no";
  onTradeTypeChange?: (t: "yes" | "no") => void;
}

export function FeaturedMarket({ market, onBuy, isLoggedIn, isPlacing, placeError, tradeType: tradeTypeProp, onTradeTypeChange }: FeaturedMarketProps) {
  const [tradeTypeLocal, setTradeTypeLocal] = useState<"yes" | "no">("yes");
  const tradeType = tradeTypeProp ?? tradeTypeLocal;
  const setTradeType = (t: "yes" | "no") => { setTradeTypeLocal(t); onTradeTypeChange?.(t); };
  const [quantity, setQuantity]   = useState("100");

  const prices    = parseOutcomePrices(market.outcomePrices);
  const yesPrice  = prices[0] ?? 0.5;
  const yesPct    = Math.round(yesPrice * 100);
  const vol       = market.volumeNum ?? market.volume ?? 0;
  const hasVolume = vol > 0;

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
              {hasVolume ? (
                <div className={cn("flex items-center gap-1 text-sm font-bold", yesPct >= 50 ? "text-yes" : "text-no")}>
                  {yesPct >= 50 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                  <span>{yesPct}%</span>
                </div>
              ) : (
                <span className="text-sm text-muted-foreground">No trades yet</span>
              )}
              <span className="text-muted-foreground text-xs">·</span>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <BarChart2 className="h-3 w-3" />
                {formatVolume(vol)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Trade panel */}
      <div className="p-5 max-w-md mx-auto w-full">
        <div className="flex flex-col gap-3">
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
              {`Yes ${yesPct}%`}
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
              {`No ${100 - yesPct}%`}
            </button>
          </div>

          {/* Amount input */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Amount (USD)</label>
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

          {placeError && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-2.5">
              <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
              <p className="text-xs text-destructive">{placeError}</p>
            </div>
          )}

          {/* Buy button */}
          <button
            onClick={() => onBuy?.(tradeType === "yes" ? "Yes" : "No", parseFloat(quantity) || 0)}
            disabled={isPlacing}
            className={cn(
              "w-full rounded-lg py-2.5 text-sm font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-60",
              tradeType === "yes"
                ? "bg-yes hover:bg-yes/90 text-primary-foreground"
                : "bg-no hover:bg-no/90 text-primary-foreground"
            )}
          >
            {isPlacing ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Placing Order...</>
            ) : !isLoggedIn && isLoggedIn !== undefined ? (
              "Log In to Trade"
            ) : (
              <>Buy {tradeType === "yes" ? "Yes" : "No"} — ${quantity || "0"}</>
            )}
          </button>

      
        </div>
      </div>
    </div>
  );
}

