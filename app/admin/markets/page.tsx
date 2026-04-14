"use client";

import { useEffect, useState, useMemo } from "react";
import { Search, ChevronUp, ChevronDown, ExternalLink, RefreshCw, Filter } from "lucide-react";
import { clientFetchMarkets, formatVolume, parseOutcomes, parseOutcomePrices, type PolyMarket } from "@/lib/polymarket";
import { cn } from "@/lib/utils";

type SortKey = "volume" | "liquidity" | "endDate" | "question";
type StatusFilter = "all" | "active" | "closed" | "featured" | "new";

export default function AdminMarkets() {
  const [markets, setMarkets] = useState<PolyMarket[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("volume");
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 20;

  const load = async () => {
    setLoading(true);
    const data = await clientFetchMarkets({ limit: 100, order: "volume", ascending: false });
    setMarkets(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    let list = [...markets];
    if (status === "active") list = list.filter((m) => m.active && !m.closed);
    else if (status === "closed") list = list.filter((m) => m.closed);
    else if (status === "featured") list = list.filter((m) => m.featured);
    else if (status === "new") list = list.filter((m) => m.new);
    if (search) list = list.filter((m) => m.question?.toLowerCase().includes(search.toLowerCase()) || m.slug?.includes(search.toLowerCase()));
    list.sort((a, b) => {
      let av: number | string = 0, bv: number | string = 0;
      if (sortKey === "volume") { av = a.volumeNum ?? a.volume ?? 0; bv = b.volumeNum ?? b.volume ?? 0; }
      else if (sortKey === "liquidity") { av = a.liquidityNum ?? a.liquidity ?? 0; bv = b.liquidityNum ?? b.liquidity ?? 0; }
      else if (sortKey === "endDate") { av = a.endDate ?? ""; bv = b.endDate ?? ""; }
      else if (sortKey === "question") { av = a.question ?? ""; bv = b.question ?? ""; }
      if (typeof av === "number" && typeof bv === "number") return sortAsc ? av - bv : bv - av;
      return sortAsc ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
    return list;
  }, [markets, status, search, sortKey, sortAsc]);

  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
    setPage(0);
  }

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return null;
    return sortAsc ? <ChevronUp className="h-3 w-3 ml-1 inline" /> : <ChevronDown className="h-3 w-3 ml-1 inline" />;
  }

  const STATUS_FILTERS: { label: string; key: StatusFilter }[] = [
    { label: "All", key: "all" },
    { label: "Active", key: "active" },
    { label: "Closed", key: "closed" },
    { label: "Featured", key: "featured" },
    { label: "New", key: "new" },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Markets</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{filtered.length} markets — live from Polymarket Gamma API</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-50"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          Refresh
        </button>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="flex items-center gap-2 flex-1 rounded-lg border border-border bg-secondary px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            type="text"
            placeholder="Search markets..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
          />
        </div>
        {/* Status filter */}
        <div className="flex items-center gap-1 rounded-lg border border-border bg-secondary p-1">
          <Filter className="h-3.5 w-3.5 text-muted-foreground ml-1.5 mr-0.5" />
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => { setStatus(f.key); setPage(0); }}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                status === f.key ? "bg-brand text-white" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                <th className="px-5 py-3 text-left">
                  <button onClick={() => toggleSort("question")} className="text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground flex items-center">
                    Market <SortIcon k="question" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left">
                  <button onClick={() => toggleSort("volume")} className="text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground flex items-center">
                    Volume <SortIcon k="volume" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left">
                  <button onClick={() => toggleSort("liquidity")} className="text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground flex items-center">
                    Liquidity <SortIcon k="liquidity" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Outcomes</th>
                <th className="px-4 py-3 text-left">
                  <button onClick={() => toggleSort("endDate")} className="text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground flex items-center">
                    Ends <SortIcon k="endDate" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Link</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="border-b border-border/40">
                      {Array.from({ length: 7 }).map((_, j) => (
                        <td key={j} className="px-5 py-3.5">
                          <div className="h-4 rounded bg-secondary animate-pulse" style={{ width: j === 0 ? "100%" : "60%" }} />
                        </td>
                      ))}
                    </tr>
                  ))
                : paged.map((m) => {
                    const outcomes = parseOutcomes(m.outcomes);
                    const prices = parseOutcomePrices(m.outcomePrices);
                    const endDate = m.endDate ? new Date(m.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" }) : "—";
                    return (
                      <tr key={m.id} className="border-b border-border/40 hover:bg-secondary/20 transition-colors">
                        <td className="px-5 py-3.5 max-w-xs">
                          <p className="font-medium text-foreground truncate text-xs leading-snug">{m.question}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">{m.id}</p>
                        </td>
                        <td className="px-4 py-3.5 font-mono text-xs font-semibold text-foreground whitespace-nowrap">
                          {formatVolume(m.volumeNum ?? m.volume)}
                        </td>
                        <td className="px-4 py-3.5 font-mono text-xs text-muted-foreground whitespace-nowrap">
                          {formatVolume(m.liquidityNum ?? m.liquidity)}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex flex-col gap-0.5">
                            {outcomes.slice(0, 2).map((o, i) => (
                              <div key={o} className="flex items-center gap-1.5">
                                <span className={cn("text-[10px] font-semibold", i === 0 ? "text-yes" : "text-no")}>{o}</span>
                                <span className="text-[10px] font-mono text-muted-foreground">{((prices[i] ?? 0.5) * 100).toFixed(0)}¢</span>
                                <div className="w-10 h-1 rounded-full bg-secondary overflow-hidden">
                                  <div className={cn("h-full rounded-full", i === 0 ? "bg-yes" : "bg-no")} style={{ width: `${(prices[i] ?? 0.5) * 100}%` }} />
                                </div>
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-xs text-muted-foreground whitespace-nowrap">{endDate}</td>
                        <td className="px-4 py-3.5">
                          <div className="flex flex-col gap-0.5">
                            <span className={cn(
                              "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold w-fit",
                              m.active && !m.closed ? "bg-yes/15 text-yes" : "bg-secondary text-muted-foreground"
                            )}>
                              {m.active && !m.closed ? "Active" : "Closed"}
                            </span>
                            <div className="flex gap-1">
                              {m.featured && <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-semibold bg-brand/15 text-brand">Featured</span>}
                              {m.new && <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-semibold bg-chart-4/20 text-chart-4">New</span>}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <a
                            href={`/market/${m.slug || m.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-brand hover:underline"
                          >
                            View <ExternalLink className="h-3 w-3" />
                          </a>
                        </td>
                      </tr>
                    );
                  })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-secondary/20">
            <p className="text-xs text-muted-foreground">
              Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
            </p>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(totalPages, 7) }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => setPage(i)}
                  className={cn(
                    "h-6 w-6 rounded text-xs font-medium transition-colors",
                    page === i ? "bg-brand text-white" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  )}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
