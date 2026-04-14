"use client";

import { useEffect, useState, useCallback } from "react";
import { RefreshCw } from "lucide-react";
import { clientFetchOrderBook, type OrderBookData, type OrderBookLevel } from "@/lib/polymarket";
import { cn } from "@/lib/utils";

interface OrderBookProps {
  tokenId: string;
  yesPct: number;
}

function OrderRow({
  level,
  side,
  maxSize,
}: {
  level: OrderBookLevel;
  side: "bid" | "ask";
  maxSize: number;
}) {
  const price = parseFloat(level.price);
  const size = parseFloat(level.size);
  const pct = maxSize > 0 ? (size / maxSize) * 100 : 0;

  return (
    <div className="relative flex items-center justify-between px-3 py-0.5 text-xs font-mono">
      {/* Depth bar */}
      <div
        className={cn(
          "absolute inset-y-0 pointer-events-none rounded-sm",
          side === "bid" ? "right-0 bg-yes/10" : "left-0 bg-no/10"
        )}
        style={{ width: `${pct}%` }}
      />
      <span className={cn("relative z-10", side === "bid" ? "text-yes" : "text-no")}>
        {(price * 100).toFixed(1)}¢
      </span>
      <span className="relative z-10 text-muted-foreground">{size.toFixed(0)}</span>
    </div>
  );
}

export function OrderBook({ tokenId, yesPct }: OrderBookProps) {
  const [book, setBook] = useState<OrderBookData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await clientFetchOrderBook(tokenId);
    setBook(data);
    setLastUpdated(new Date());
    setLoading(false);
  }, [tokenId]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 15_000);
    return () => clearInterval(interval);
  }, [load]);

  const bids = (book?.bids ?? []).slice(0, 8);
  const asks = (book?.asks ?? []).slice(0, 8).reverse();
  const maxBidSize = Math.max(...bids.map((b) => parseFloat(b.size)), 1);
  const maxAskSize = Math.max(...asks.map((a) => parseFloat(a.size)), 1);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
        <h3 className="text-sm font-semibold text-foreground">Order Book</h3>
        <div className="flex items-center gap-2">
          {lastUpdated && (
            <span className="text-xs text-muted-foreground">
              {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
          )}
          <button
            onClick={load}
            disabled={loading}
            className="rounded p-1 text-muted-foreground hover:text-foreground transition-colors"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* Column headers */}
      <div className="flex items-center justify-between px-3 py-1.5 text-xs text-muted-foreground border-b border-border/30">
        <span>Price</span>
        <span>Size (USDC)</span>
      </div>

      {!book || (bids.length === 0 && asks.length === 0) ? (
        <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
          {loading ? "Loading order book..." : "No open orders"}
        </div>
      ) : (
        <>
          {/* Asks (sell orders — red) */}
          <div className="divide-y divide-border/20">
            {asks.length === 0 ? (
              <p className="px-3 py-2 text-xs text-muted-foreground italic">No asks</p>
            ) : (
              asks.map((ask, i) => (
                <OrderRow key={i} level={ask} side="ask" maxSize={maxAskSize} />
              ))
            )}
          </div>

          {/* Spread / midpoint row */}
          <div className="flex items-center justify-between px-3 py-2 bg-secondary/40 border-y border-border/40">
            <span className="text-xs font-semibold text-foreground">Mid</span>
            <span className="text-xs font-mono font-bold text-brand">{yesPct}¢</span>
            <span className="text-xs text-muted-foreground">
              Spread:{" "}
              {asks[0] && bids[0]
                ? `${((parseFloat(asks[0].price) - parseFloat(bids[bids.length - 1]?.price ?? "0")) * 100).toFixed(1)}¢`
                : "—"}
            </span>
          </div>

          {/* Bids (buy orders — green) */}
          <div className="divide-y divide-border/20">
            {bids.length === 0 ? (
              <p className="px-3 py-2 text-xs text-muted-foreground italic">No bids</p>
            ) : (
              bids.map((bid, i) => (
                <OrderRow key={i} level={bid} side="bid" maxSize={maxBidSize} />
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
