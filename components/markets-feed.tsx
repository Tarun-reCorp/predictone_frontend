"use client";

import { useState } from "react";
import { LayoutGrid, List, SlidersHorizontal } from "lucide-react";
import { type PolyMarket } from "@/lib/polymarket";
import { MarketCard, MarketCardSkeleton } from "@/components/market-card";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationPrevious,
  PaginationNext,
  PaginationLink,
  PaginationEllipsis,
} from "@/components/ui/pagination";
import { cn } from "@/lib/utils";

const SORT_OPTIONS = [
  { label: "Volume", value: "volume" },
  { label: "Liquidity", value: "liquidity" },
  { label: "Newest", value: "startDate" },
  { label: "Ending Soon", value: "endDate" },
];

interface MarketsFeedProps {
  markets: PolyMarket[];
  loading?: boolean;
  title?: string;
  page?: number;
  hasMore?: boolean;
  onPageChange?: (page: number) => void;
}

export function MarketsFeed({
  markets,
  loading = false,
  title,
  page = 0,
  hasMore = false,
  onPageChange,
}: MarketsFeedProps) {
  const [view, setView] = useState<"grid" | "list">("grid");
  const [sort, setSort] = useState("volume");

  const sortedMarkets = [...markets].sort((a, b) => {
    if (sort === "volume") return (b.volumeNum ?? b.volume ?? 0) - (a.volumeNum ?? a.volume ?? 0);
    if (sort === "liquidity") return (b.liquidityNum ?? b.liquidity ?? 0) - (a.liquidityNum ?? a.liquidity ?? 0);
    return 0;
  });

  const hasPrev = page > 0;
  const currentPage = page + 1; // display as 1-indexed

  // Visible page numbers: always show prev, current, next within known range
  const visiblePages: number[] = [];
  if (hasPrev) visiblePages.push(page - 1);
  visiblePages.push(page);
  if (hasMore) visiblePages.push(page + 1);

  return (
    <section>
      {/* Controls */}
      <div className="flex items-center justify-between gap-3 mb-4">
        {title && <h2 className="text-base font-semibold text-foreground">{title}</h2>}
        <div className="flex items-center gap-2 ml-auto">
          {/* Sort */}
          <div className="flex items-center gap-1 rounded-lg border border-border bg-card px-2 py-1.5">
            <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="bg-transparent text-xs text-foreground outline-none cursor-pointer"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value} className="bg-card">
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {/* View toggle */}
          <div className="flex items-center rounded-lg border border-border bg-card overflow-hidden">
            <button
              onClick={() => setView("grid")}
              className={cn(
                "p-1.5 transition-colors",
                view === "grid" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setView("list")}
              className={cn(
                "p-1.5 transition-colors",
                view === "list" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div
          className={cn(
            "grid gap-3",
            view === "grid" ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" : "grid-cols-1"
          )}
        >
          {Array.from({ length: 8 }).map((_, i) => (
            <MarketCardSkeleton key={i} />
          ))}
        </div>
      ) : sortedMarkets.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-muted-foreground text-sm">No markets found.</p>
        </div>
      ) : (
        <div
          className={cn(
            "grid gap-3",
            view === "grid" ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" : "grid-cols-1"
          )}
        >
          {sortedMarkets.map((market) => (
            <MarketCard key={market.conditionId} market={market} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {(hasPrev || hasMore) && !loading && onPageChange && (
        <div className="mt-6">
          <Pagination>
            <PaginationContent>
              {/* Previous */}
              <PaginationItem>
                <PaginationPrevious
                  onClick={hasPrev ? () => { onPageChange(page - 1); window.scrollTo({ top: 0, behavior: "smooth" }); } : undefined}
                  className={cn(!hasPrev && "pointer-events-none opacity-40")}
                />
              </PaginationItem>

              {/* Show first page + ellipsis if current page is far ahead */}
              {page > 2 && (
                <>
                  <PaginationItem>
                    <PaginationLink onClick={() => { onPageChange(0); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
                      1
                    </PaginationLink>
                  </PaginationItem>
                  {page > 3 && (
                    <PaginationItem>
                      <PaginationEllipsis />
                    </PaginationItem>
                  )}
                </>
              )}

              {/* Visible page buttons */}
              {visiblePages.map((p) => (
                <PaginationItem key={p}>
                  <PaginationLink
                    isActive={p === page}
                    onClick={() => { onPageChange(p); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                  >
                    {p + 1}
                  </PaginationLink>
                </PaginationItem>
              ))}

              {/* Next */}
              <PaginationItem>
                <PaginationNext
                  onClick={hasMore ? () => { onPageChange(page + 1); window.scrollTo({ top: 0, behavior: "smooth" }); } : undefined}
                  className={cn(!hasMore && "pointer-events-none opacity-40")}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>

          <p className="text-center text-xs text-muted-foreground mt-2">
            Page {currentPage}
          </p>
        </div>
      )}
    </section>
  );
}
