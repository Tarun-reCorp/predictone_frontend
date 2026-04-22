"use client";

import { useEffect, useState, useCallback } from "react";
import { Search, RefreshCw, Filter, ChevronLeft, ChevronRight, Loader2, TrendingUp } from "lucide-react";
import { formatVolume } from "@/lib/polymarket";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const PAGE_SIZE = 20;

const CATEGORIES = [
  "All", "Crypto", "Politics", "Sports", "Entertainment",
  "Business", "World News", "Technology", "Finance", "Other",
];

const STATUS_FILTERS = [
  { label: "All",       key: "" },
  { label: "Active",    key: "active" },
  { label: "Closed",    key: "closed" },
  { label: "Resolved",  key: "resolved" },
  { label: "Cancelled", key: "cancelled" },
];

interface DbMarket {
  _id: string;
  marketUniqueId: string;
  question: string;
  slug: string;
  category: string;
  status: string;
  active: boolean;
  closed: boolean;
  totalVolume: number;
  yesPool: number;
  noPool: number;
  yesPercent: number;
  noPercent: number;
  totalOrders: number;
  totalUsers: number;
  image?: string;
  endDate?: string;
  createdAt: string;
  result?: string | null;
}

export default function AdminMarkets() {
  const { token } = useAuth();

  const [markets, setMarkets]     = useState<DbMarket[]>([]);
  const [loading, setLoading]     = useState(true);
  const [syncing, setSyncing]     = useState(false);
  const [search, setSearch]       = useState("");
  const [category, setCategory]   = useState("");
  const [status, setStatus]       = useState("");
  const [page, setPage]           = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal]         = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      query.set("page", String(page));
      query.set("limit", String(PAGE_SIZE));
      if (category) query.set("category", category);
      if (status) query.set("status", status);

      // Use search endpoint or regular endpoint
      let url: string;
      if (search.trim().length >= 2) {
        query.set("q", search.trim());
        url = `${BACKEND}/api/markets/search?${query}`;
      } else if (status) {
        url = `${BACKEND}/api/markets/all?${query}`;
      } else {
        url = `${BACKEND}/api/markets?${query}`;
      }

      const headers: Record<string, string> = { Accept: "application/json" };
      // /all endpoint needs auth
      if (status && token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch(url, { headers });
      if (!res.ok) { setMarkets([]); return; }

      const json = await res.json();
      const list = json.data ?? [];
      setMarkets(Array.isArray(list) ? list : []);
      setTotal(json.meta?.total ?? list.length);
      setTotalPages(json.meta?.totalPages ?? 1);
    } catch {
      setMarkets([]);
    } finally {
      setLoading(false);
    }
  }, [page, category, status, search, token]);

  useEffect(() => { load(); }, [load]);

  const handleSync = async () => {
    if (!token || syncing) return;
    setSyncing(true);
    try {
      await fetch(`${BACKEND}/api/admin/markets/sync`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      await load();
    } catch {}
    setSyncing(false);
  };

  const handleSearch = (val: string) => {
    setSearch(val);
    setPage(1);
  };

  const STATUS_STYLE: Record<string, string> = {
    active:    "bg-yes/15 text-yes",
    closed:    "bg-muted-foreground/15 text-muted-foreground",
    resolved:  "bg-brand/15 text-brand",
    cancelled: "bg-no/15 text-no",
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Markets</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {total} markets in database
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-1.5 rounded-lg border border-brand/30 bg-brand/10 px-3 py-1.5 text-xs font-medium text-brand hover:bg-brand/20 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", syncing && "animate-spin")} />
            Sync from Polymarket
          </button>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            Refresh
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-3">
        {/* Search */}
        <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            type="text"
            placeholder="Search markets..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
          />
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          {/* Status filter */}
          <div className="flex items-center gap-1 rounded-lg border border-border bg-secondary p-1">
            <Filter className="h-3.5 w-3.5 text-muted-foreground ml-1.5 mr-0.5" />
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => { setStatus(f.key); setPage(1); }}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  status === f.key ? "bg-brand text-white" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Category filter */}
          <div className="flex items-center gap-1 rounded-lg border border-border bg-secondary p-1 overflow-x-auto">
            <TrendingUp className="h-3.5 w-3.5 text-muted-foreground ml-1.5 mr-0.5 shrink-0" />
            {CATEGORIES.map((cat) => {
              const val = cat === "All" ? "" : cat;
              return (
                <button
                  key={cat}
                  onClick={() => { setCategory(val); setPage(1); }}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap",
                    category === val ? "bg-brand text-white" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">ID</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Market</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Category</th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Volume</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Yes / No</th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Orders</th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Users</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Link</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {loading
                ? Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 9 }).map((_, j) => (
                        <td key={j} className="px-5 py-4">
                          <div className="h-4 rounded bg-secondary animate-pulse" style={{ width: j === 1 ? "100%" : "60%" }} />
                        </td>
                      ))}
                    </tr>
                  ))
                : markets.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-5 py-14 text-center">
                        <p className="text-sm text-muted-foreground">No markets found</p>
                      </td>
                    </tr>
                  )
                : markets.map((m) => {
                    const hasVolume = m.totalVolume > 0;
                    const endDate = m.endDate
                      ? new Date(m.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" })
                      : null;
                    return (
                      <tr key={m._id} className="hover:bg-secondary/20 transition-colors">
                        <td className="px-4 py-3">
                          <span className="text-xs font-mono text-muted-foreground">{m.marketUniqueId}</span>
                        </td>
                        <td className="px-4 py-3 max-w-xs">
                          <p className="text-sm font-medium text-foreground truncate leading-snug">{m.question}</p>
                          {endDate && (
                            <p className="text-xs text-muted-foreground mt-0.5">Ends {endDate}</p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground">
                            {m.category}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-sm font-semibold text-foreground whitespace-nowrap">
                          {formatVolume(m.totalVolume)}
                        </td>
                        <td className="px-4 py-3">
                          {hasVolume ? (
                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-semibold text-yes">Yes</span>
                                <div className="w-12 h-1 rounded-full bg-secondary overflow-hidden">
                                  <div className="h-full bg-yes rounded-full" style={{ width: `${m.yesPercent}%` }} />
                                </div>
                                <span className="text-xs font-mono text-muted-foreground">{m.yesPercent.toFixed(0)}%</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-semibold text-no">No</span>
                                <div className="w-12 h-1 rounded-full bg-secondary overflow-hidden">
                                  <div className="h-full bg-no rounded-full" style={{ width: `${m.noPercent}%` }} />
                                </div>
                                <span className="text-xs font-mono text-muted-foreground">{m.noPercent.toFixed(0)}%</span>
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">No trades</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-sm text-muted-foreground">
                          {m.totalOrders}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-sm text-muted-foreground">
                          {m.totalUsers}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-0.5">
                            <span className={cn(
                              "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold w-fit capitalize",
                              STATUS_STYLE[m.status] ?? "bg-secondary text-muted-foreground"
                            )}>
                              {m.status}
                            </span>
                            {m.result && (
                              <span className="text-xs text-muted-foreground">
                                Result: <span className="font-semibold capitalize">{m.result}</span>
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <a
                            href={`/market/${m.slug || m._id}`}
                            className="text-sm text-brand hover:underline"
                          >
                            View
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
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(page - 1)}
                disabled={page <= 1}
                className="flex items-center gap-1 rounded border border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-40 transition-colors"
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Prev
              </button>
              {Array.from({ length: Math.min(totalPages, 7) }).map((_, i) => {
                const p = i + 1;
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={cn(
                      "h-6 w-6 rounded text-xs font-medium transition-colors",
                      page === p ? "bg-brand text-white" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                    )}
                  >
                    {p}
                  </button>
                );
              })}
              <button
                onClick={() => setPage(page + 1)}
                disabled={page >= totalPages}
                className="flex items-center gap-1 rounded border border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-40 transition-colors"
              >
                Next <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
