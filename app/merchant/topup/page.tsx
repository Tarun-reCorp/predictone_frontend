"use client";

import { useEffect, useState, useCallback } from "react";
import {
  HandCoins, Loader2, ChevronLeft, ChevronRight, X, Download,
} from "lucide-react";
import * as XLSX from "xlsx";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface TopupRecord {
  _id: string;
  performedBy: { _id: string; name: string } | null;
  type: "credit" | "debit";
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  description: string;
  createdAt: string;
}

const TYPE_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  credit: { label: "Credit", color: "text-yes", bg: "bg-yes/15" },
  debit:  { label: "Debit",  color: "text-no",  bg: "bg-no/15"  },
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function MerchantTopupPage() {
  const { token } = useAuth();

  const [history, setHistory]       = useState<TopupRecord[]>([]);
  const [loading, setLoading]       = useState(true);
  const [page, setPage]             = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal]           = useState(0);

  const [filter, setFilter]         = useState("");
  const [minAmt, setMinAmt]         = useState("");
  const [maxAmt, setMaxAmt]         = useState("");
  const [dateFrom, setDateFrom]     = useState("");
  const [dateTo, setDateTo]         = useState("");
  const [datePreset, setDatePreset] = useState<"all"|"today"|"week"|"month">("all");
  const [exporting, setExporting]   = useState(false);

  const activeFilters = [filter, minAmt, maxAmt, dateFrom, dateTo].filter(Boolean).length;

  const buildParams = (extra: Record<string,string> = {}) => {
    const p = new URLSearchParams(extra);
    if (filter)   p.set("type",      filter);
    if (minAmt)   p.set("minAmount", minAmt);
    if (maxAmt)   p.set("maxAmount", maxAmt);
    if (dateFrom) p.set("dateFrom",  dateFrom);
    if (dateTo)   p.set("dateTo",    dateTo);
    return p;
  };

  const fetchHistory = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params = buildParams({ page: String(page), limit: "15" });
      const res  = await fetch(`${API}/api/merchant/topup-history?${params}`, { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      setHistory(json.data ?? []);
      setTotal(json.meta?.total ?? 0);
      setTotalPages(json.meta?.totalPages ?? 1);
    } catch {} finally { setLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, page, filter, minAmt, maxAmt, dateFrom, dateTo]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const applyDatePreset = (preset: typeof datePreset) => {
    setDatePreset(preset); setPage(1);
    const today = new Date();
    const s = (d: Date) => d.toISOString().slice(0, 10);
    if (preset === "all")        { setDateFrom(""); setDateTo(""); }
    else if (preset === "today") { setDateFrom(s(today)); setDateTo(s(today)); }
    else if (preset === "week")  { const f = new Date(today); f.setDate(today.getDate()-6); setDateFrom(s(f)); setDateTo(s(today)); }
    else if (preset === "month") { setDateFrom(s(new Date(today.getFullYear(), today.getMonth(), 1))); setDateTo(s(today)); }
  };

  const clearFilters = () => {
    setFilter(""); setMinAmt(""); setMaxAmt(""); setDateFrom(""); setDateTo(""); setDatePreset("all"); setPage(1);
  };

  const exportToExcel = async () => {
    if (!token) return;
    setExporting(true);
    try {
      const params = buildParams({ page: "1", limit: "5000" });
      const res  = await fetch(`${API}/api/merchant/topup-history?${params}`, { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      const rows: TopupRecord[] = json.data ?? [];
      const sheet = rows.map((r, i) => ({
        "#":              i + 1,
        "Type":           r.type,
        "Amount ($)":     r.amount,
        "Balance Before": r.balanceBefore,
        "Balance After":  r.balanceAfter,
        "Description":    r.description || "—",
        "By":             r.performedBy?.name ?? "—",
        "Date":           new Date(r.createdAt).toLocaleString("en-IN"),
      }));
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(sheet);
      ws["!cols"] = [{ wch: 4 }, { wch: 8 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 30 }, { wch: 16 }, { wch: 22 }];
      XLSX.utils.book_append_sheet(wb, ws, "Topup History");
      XLSX.writeFile(wb, `topup_history_${new Date().toISOString().slice(0,10)}.xlsx`);
    } catch {} finally { setExporting(false); }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Topup History</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            View all credits, debits, fund approvals and refunds on your wallet.
          </p>
        </div>
        <button onClick={exportToExcel} disabled={exporting || total === 0}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-secondary/50 hover:bg-secondary px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors">
          {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
          {exporting ? "Exporting…" : "Export Excel"}
        </button>
      </div>

      {/* Date presets */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {(["all", "today", "week", "month"] as const).map(p => {
          const label = { all: "All Time", today: "Today", week: "Last 7 Days", month: "This Month" }[p];
          return (
            <button key={p} onClick={() => applyDatePreset(p)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium border transition-colors",
                datePreset === p
                  ? "bg-brand text-white border-brand"
                  : "bg-secondary/50 text-muted-foreground border-border hover:text-foreground hover:bg-secondary"
              )}>
              {label}
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-border bg-card px-4 py-3">
        <div className="flex flex-wrap gap-2">
          {/* Type */}
          <select value={filter} onChange={e => { setFilter(e.target.value); setPage(1); }}
            className="rounded-md border border-border bg-secondary/40 px-2.5 h-8 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-brand/50 w-32">
            <option value="">All Types</option>
            <option value="credit">Credit</option>
            <option value="debit">Debit</option>
          </select>

          {/* Amount range */}
          <div className="flex items-center gap-1">
            <input value={minAmt} onChange={e => { setMinAmt(e.target.value); setPage(1); }} type="number" min="0"
              placeholder="Min $"
              className="w-20 rounded-md border border-border bg-secondary/40 px-2.5 h-8 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-brand/50 transition-colors" />
            <span className="text-muted-foreground text-xs">–</span>
            <input value={maxAmt} onChange={e => { setMaxAmt(e.target.value); setPage(1); }} type="number" min="0"
              placeholder="Max $"
              className="w-20 rounded-md border border-border bg-secondary/40 px-2.5 h-8 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-brand/50 transition-colors" />
          </div>

          {/* Date range */}
          <div className="flex items-center gap-1">
            <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setDatePreset("all"); setPage(1); }}
              className="rounded-md border border-border bg-secondary/40 px-2 h-8 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-brand/50 transition-colors" />
            <span className="text-muted-foreground text-xs">–</span>
            <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setDatePreset("all"); setPage(1); }}
              className="rounded-md border border-border bg-secondary/40 px-2 h-8 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-brand/50 transition-colors" />
          </div>

          {activeFilters > 0 && (
            <button onClick={clearFilters}
              className="flex items-center gap-1 rounded-md border border-border bg-secondary/40 px-2.5 h-8 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors whitespace-nowrap">
              <X className="h-3 w-3" /> Clear ({activeFilters})
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-border">
          <HandCoins className="h-4 w-4 text-brand" />
          <h2 className="text-sm font-semibold text-foreground">History</h2>
          {total > 0 && (
            <span className="rounded-full bg-brand/20 text-brand text-xs font-bold px-2 py-0.5">{total}</span>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-14"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : history.length === 0 ? (
          <div className="flex flex-col items-center py-14 gap-2 text-center">
            <HandCoins className="h-9 w-9 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">
              {activeFilters > 0 ? "No records match the filters" : "No topup records yet"}
            </p>
            {activeFilters > 0 && (
              <button onClick={clearFilters} className="text-xs text-brand hover:underline mt-1">Clear filters</button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/30">
                    {["#", "Type", "Amount", "Balance After", "Description", "By", "Date"].map((h, i) => (
                      <th key={h} className={cn(
                        "px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground",
                        (i === 2 || i === 3) ? "text-right" : "text-left"
                      )}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {history.map((rec, idx) => {
                    const style = TYPE_STYLE[rec.type] ?? { label: rec.type, color: "text-foreground", bg: "bg-secondary" };
                    const isCredit = rec.type === "credit";
                    return (
                      <tr key={rec._id} className="hover:bg-secondary/20 transition-colors">
                        <td className="px-4 py-3 text-xs text-muted-foreground">{(page-1)*15 + idx + 1}</td>
                        <td className="px-4 py-3">
                          <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold", style.color, style.bg)}>
                            {style.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={cn("font-mono font-bold text-sm", isCredit ? "text-yes" : "text-no")}>
                            {isCredit ? "+" : "-"}${rec.amount.toFixed(2)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-sm text-foreground">${rec.balanceAfter.toFixed(2)}</td>
                        <td className="px-4 py-3 max-w-[220px]">
                          <p className="text-sm text-muted-foreground truncate">{rec.description || "—"}</p>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{rec.performedBy?.name ?? "—"}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">{fmtDate(rec.createdAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between px-5 py-3 border-t border-border">
              <span className="text-xs text-muted-foreground">
                Page <b>{page}</b> of <b>{totalPages}</b> &mdash; {total} records
              </span>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(p => p - 1)} disabled={page <= 1}
                  className="flex items-center gap-1 rounded border border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-40 transition-colors">
                  <ChevronLeft className="h-3.5 w-3.5" /> Prev
                </button>
                <button onClick={() => setPage(p => p + 1)} disabled={page >= totalPages}
                  className="flex items-center gap-1 rounded border border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-40 transition-colors">
                  Next <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
