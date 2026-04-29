"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ArrowUpDown, ChevronLeft, ChevronRight,
  Receipt, TrendingUp, TrendingDown, Activity,
  Loader2, Search, X, Download,
  ArrowUpCircle, ArrowDownCircle,
} from "lucide-react";
import * as XLSX from "xlsx";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface AdminTransaction {
  _id: string;
  userId?: { name?: string; email?: string } | string;
  type: string;
  amount: number;
  balanceAfter: number;
  description?: string;
  createdAt: string;
  refModel?: string | null;
  refId?: { orderNumber?: string } | null;
}

const TX_META: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  fund_credit:     { label: "Fund Credit",     color: "text-yes",     bg: "bg-yes/10",     icon: ArrowUpCircle   },
  order_deduction: { label: "Order Deduction", color: "text-no",      bg: "bg-no/10",      icon: ArrowDownCircle },
  commission:      { label: "Commission",      color: "text-chart-4", bg: "bg-chart-4/10", icon: Receipt         },
  admin_credit:    { label: "Admin Credit",    color: "text-yes",     bg: "bg-yes/10",     icon: ArrowUpCircle   },
  admin_debit:     { label: "Admin Debit",     color: "text-no",      bg: "bg-no/10",      icon: ArrowDownCircle },
  refund:          { label: "Refund",          color: "text-brand",   bg: "bg-brand/10",   icon: ArrowUpCircle   },
  withdraw_debit:  { label: "Withdrawal",      color: "text-no",      bg: "bg-no/10",      icon: ArrowDownCircle },
  withdraw_refund: { label: "Withdraw Refund", color: "text-brand",   bg: "bg-brand/10",   icon: ArrowUpCircle   },
};

const ALL_TYPES = Object.keys(TX_META);

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

interface Filters {
  merchantSearch: string;
  type:           string;
  dateFrom:       string;
  dateTo:         string;
}

const EMPTY: Filters = { merchantSearch: "", type: "", dateFrom: "", dateTo: "" };

function buildFilterParams(f: Filters, extra: Record<string, string> = {}): URLSearchParams {
  const q = new URLSearchParams(extra);
  if (f.merchantSearch) q.set("merchantSearch", f.merchantSearch);
  if (f.type)           q.set("type",           f.type);
  if (f.dateFrom)       q.set("dateFrom",       f.dateFrom);
  if (f.dateTo)         q.set("dateTo",         f.dateTo);
  return q;
}

export default function AdminTransactionsPage() {
  const { token } = useAuth();

  const [txns, setTxns]             = useState<AdminTransaction[]>([]);
  const [loading, setLoading]       = useState(true);
  const [page, setPage]             = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal]           = useState(0);
  const [filters, setFilters]       = useState<Filters>(EMPTY);
  const [datePreset, setDatePreset] = useState<"all" | "today" | "week" | "month">("all");
  const [exporting, setExporting]   = useState(false);

  const activeCount = Object.values(filters).filter((v) => v !== "").length;

  const applyDatePreset = (preset: typeof datePreset) => {
    setDatePreset(preset);
    setPage(1);
    const today = new Date();
    const toStr = (d: Date) => d.toISOString().slice(0, 10);
    if (preset === "all") {
      setFilters((f) => ({ ...f, dateFrom: "", dateTo: "" }));
    } else if (preset === "today") {
      const s = toStr(today);
      setFilters((f) => ({ ...f, dateFrom: s, dateTo: s }));
    } else if (preset === "week") {
      const from = new Date(today); from.setDate(today.getDate() - 6);
      setFilters((f) => ({ ...f, dateFrom: toStr(from), dateTo: toStr(today) }));
    } else if (preset === "month") {
      setFilters((f) => ({ ...f, dateFrom: toStr(new Date(today.getFullYear(), today.getMonth(), 1)), dateTo: toStr(today) }));
    }
  };

  const fetchTxns = useCallback((pg: number, f: Filters, signal?: AbortSignal) => {
    if (!token) return;
    setLoading(true);
    const q = buildFilterParams(f, { page: String(pg), limit: "15" });
    fetch(`${BACKEND}/api/admin/transactions?${q}`, {
      headers: { Authorization: `Bearer ${token}` }, signal,
    })
      .then((r) => r.json())
      .then((data) => {
        setTxns(data.data ?? data.docs ?? []);
        setTotalPages(data.meta?.totalPages ?? data.totalPages ?? 1);
        setTotal(data.meta?.total ?? data.total ?? 0);
      })
      .catch((err) => { if (err.name !== "AbortError") setTxns([]); })
      .finally(() => { if (!signal?.aborted) setLoading(false); });
  }, [token]);

  useEffect(() => {
    const controller = new AbortController();
    const t = setTimeout(() => fetchTxns(page, filters, controller.signal), 400);
    return () => { clearTimeout(t); controller.abort(); };
  }, [page, filters, fetchTxns]);

  const set = (key: keyof Filters) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setPage(1);
      if (key === "dateFrom" || key === "dateTo") setDatePreset("all");
      setFilters((f) => ({ ...f, [key]: e.target.value }));
    };

  const clearAll = () => { setFilters(EMPTY); setPage(1); setDatePreset("all"); };

  const exportToExcel = async () => {
    if (!token) return;
    setExporting(true);
    try {
      const q = buildFilterParams(filters, { page: "1", limit: "5000" });
      const res  = await fetch(`${BACKEND}/api/admin/transactions?${q}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      const rows: AdminTransaction[] = data.data ?? data.docs ?? [];

      const sheet = rows.map((tx, i) => {
        const user = typeof tx.userId === "object" ? tx.userId : null;
        return {
          "#":              i + 1,
          "Merchant":       user?.name  ?? "—",
          "Email":          user?.email ?? "—",
          "Type":           TX_META[tx.type]?.label ?? tx.type.replace(/_/g, " "),
          "Order ID":       tx.refModel === "Order" ? (tx.refId?.orderNumber ?? "—") : "—",
          "Amount ($)":     tx.amount,
          "Balance After":  tx.balanceAfter,
          "Description":    tx.description ?? "—",
          "Date":           new Date(tx.createdAt).toLocaleString("en-IN"),
        };
      });

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(sheet);
      ws["!cols"] = [
        { wch: 5 }, { wch: 20 }, { wch: 26 }, { wch: 18 },
        { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 32 }, { wch: 22 },
      ];
      XLSX.utils.book_append_sheet(wb, ws, "Transactions");
      XLSX.writeFile(wb, `transactions_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch { /* silent */ } finally { setExporting(false); }
  };

  const credits = txns.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const debits  = txns.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);

  return (
    <div className="flex flex-col gap-4">

      {/* ── Heading ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ArrowUpDown className="h-5 w-5 text-brand" />
          <h1 className="text-xl font-bold text-foreground">All Transactions</h1>
          {total > 0 && (
            <span className="rounded-full bg-brand/20 text-brand text-xs font-bold px-2 py-0.5 ml-1">{total}</span>
          )}
        </div>
        <button
          onClick={exportToExcel}
          disabled={exporting || total === 0}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-secondary/50 hover:bg-secondary px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors"
        >
          {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
          {exporting ? "Exporting…" : "Export Excel"}
        </button>
      </div>

      {/* ── Date presets + Summary cards ── */}
      <div className="space-y-2.5">
        <div className="flex items-center gap-1.5">
          {(["all", "today", "week", "month"] as const).map((p) => {
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

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <SummaryCard icon={Activity}    label="Total Txns"   value={loading ? "…" : String(total)}
            accent="text-brand"   bg="bg-brand/10"
            sub={datePreset !== "all" ? { today: "Today", week: "Last 7 days", month: "This month" }[datePreset] : undefined} />
          <SummaryCard icon={Receipt}     label="Page Volume"
            value={loading ? "…" : `$${txns.reduce((s, t) => s + Math.abs(t.amount), 0).toFixed(2)}`}
            accent="text-chart-4" bg="bg-chart-4/10" sub="Current page" />
          <SummaryCard icon={TrendingUp}  label="Credits"
            value={loading ? "…" : `+$${credits.toFixed(2)}`}
            accent="text-yes"     bg="bg-yes/10" sub="Current page" />
          <SummaryCard icon={TrendingDown} label="Debits"
            value={loading ? "…" : `-$${debits.toFixed(2)}`}
            accent="text-no"      bg="bg-no/10" sub="Current page" />
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="rounded-xl border border-border bg-card px-4 py-3">
        <div className="flex flex-wrap gap-2">
          {/* Merchant search */}
          <div className="relative flex-1 min-w-[160px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
            <input value={filters.merchantSearch} onChange={set("merchantSearch")}
              placeholder="Search merchant"
              className="w-full rounded-md border border-border bg-secondary/40 pl-7 pr-2.5 h-8 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-brand/50 focus:border-brand/50 transition-colors" />
          </div>

          {/* Type */}
          <select value={filters.type} onChange={set("type")}
            className="rounded-md border border-border bg-secondary/40 px-2.5 h-8 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-brand/50 focus:border-brand/50 transition-colors w-44">
            <option value="">All Types</option>
            {ALL_TYPES.map((t) => (
              <option key={t} value={t}>{TX_META[t].label}</option>
            ))}
          </select>

          {/* Date range */}
          <div className="flex items-center gap-1">
            <input type="date" value={filters.dateFrom} onChange={set("dateFrom")}
              className="rounded-md border border-border bg-secondary/40 px-2 h-8 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-brand/50 focus:border-brand/50 transition-colors" />
            <span className="text-muted-foreground text-xs">–</span>
            <input type="date" value={filters.dateTo} onChange={set("dateTo")}
              className="rounded-md border border-border bg-secondary/40 px-2 h-8 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-brand/50 focus:border-brand/50 transition-colors" />
          </div>

          {activeCount > 0 && (
            <button onClick={clearAll}
              className="flex items-center gap-1 rounded-md border border-border bg-secondary/40 px-2.5 h-8 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors whitespace-nowrap">
              <X className="h-3 w-3" /> Clear ({activeCount})
            </button>
          )}
        </div>
      </div>

      {/* ── Table ── */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {loading ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-border/60">
                {Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-4 py-3.5"><div className="h-3.5 w-6 rounded bg-secondary" /></td>
                    <td className="px-4 py-3.5"><div className="h-3.5 w-28 rounded bg-secondary" /></td>
                    <td className="px-4 py-3.5"><div className="h-6 w-24 rounded-lg bg-secondary" /></td>
                    <td className="px-4 py-3.5"><div className="h-3.5 w-20 rounded bg-secondary" /></td>
                    <td className="px-4 py-3.5"><div className="h-3.5 w-16 rounded bg-secondary ml-auto" /></td>
                    <td className="px-4 py-3.5"><div className="h-3.5 w-16 rounded bg-secondary ml-auto" /></td>
                    <td className="px-4 py-3.5"><div className="h-3.5 w-40 rounded bg-secondary" /></td>
                    <td className="px-4 py-3.5"><div className="h-3.5 w-24 rounded bg-secondary" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : txns.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
            <ArrowUpDown className="h-9 w-9 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">
              {activeCount > 0 ? "No transactions match the applied filters" : "No transactions found"}
            </p>
            {activeCount > 0 && (
              <button onClick={clearAll} className="text-xs text-brand hover:underline mt-1">Clear filters</button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/30">
                    {["#", "Merchant", "Type", "Order ID", "Amount", "Balance After", "Description", "Date"].map((h) => (
                      <th key={h} className={cn(
                        "px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground",
                        h === "Amount" || h === "Balance After" ? "text-right" : "text-left"
                      )}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {txns.map((tx, idx) => {
                    const user   = typeof tx.userId === "object" ? tx.userId : null;
                    const meta   = TX_META[tx.type] ?? { label: tx.type.replace(/_/g, " "), color: "text-foreground", bg: "bg-secondary", icon: Receipt };
                    const isCredit = tx.amount > 0;
                    return (
                      <tr key={tx._id} className="hover:bg-secondary/20 transition-colors">
                        <td className="px-4 py-3 text-sm text-muted-foreground">{(page - 1) * 15 + idx + 1}</td>
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium text-foreground">{user?.name ?? "—"}</p>
                          {user?.email && <p className="text-xs text-muted-foreground">{user.email}</p>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className={cn("flex h-7 w-7 items-center justify-center rounded-lg shrink-0", meta.bg)}>
                              <meta.icon className={cn("h-3.5 w-3.5", meta.color)} />
                            </div>
                            <span className={cn("text-sm font-medium capitalize", meta.color)}>{meta.label}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {tx.refModel === "Order" && tx.refId?.orderNumber ? (
                            <span className="text-xs font-mono text-brand font-semibold">{tx.refId.orderNumber}</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={cn("text-sm font-bold font-mono", isCredit ? "text-yes" : "text-no")}>
                            {isCredit ? "+" : "–"}${Math.abs(tx.amount).toFixed(2)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-sm font-mono text-foreground">${tx.balanceAfter.toFixed(2)}</span>
                        </td>
                        <td className="px-4 py-3 max-w-[180px]">
                          <p className="truncate text-sm text-muted-foreground">{tx.description || "—"}</p>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">{fmt(tx.createdAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between px-5 py-3 border-t border-border">
              <span className="text-xs text-muted-foreground">Page {page} of {totalPages}</span>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage((p) => p - 1)} disabled={page <= 1}
                  className="flex items-center gap-1 rounded border border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-40 transition-colors">
                  <ChevronLeft className="h-3.5 w-3.5" /> Prev
                </button>
                <button onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages}
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

function SummaryCard({ icon: Icon, label, value, accent, bg, sub }: {
  icon: React.ElementType; label: string; value: string;
  accent: string; bg: string; sub?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
      <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg shrink-0", bg)}>
        <Icon className={cn("h-4 w-4", accent)} />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={cn("text-lg font-bold font-mono mt-0.5", accent)}>{value}</p>
        {sub && <p className="text-[10px] text-muted-foreground/60 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}
