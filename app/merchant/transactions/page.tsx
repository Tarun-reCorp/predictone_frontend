"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ArrowUpCircle, ArrowDownCircle, Receipt,
  ChevronLeft, ChevronRight, Loader2, X,
  TrendingUp, TrendingDown, Activity, Download,
} from "lucide-react";
import * as XLSX from "xlsx";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface WalletTx {
  _id: string;
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

export default function MerchantTransactionsPage() {
  const { token } = useAuth();

  const [txns, setTxns]             = useState<WalletTx[]>([]);
  const [loading, setLoading]       = useState(true);
  const [page, setPage]             = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal]           = useState(0);

  const [typeFilter, setTypeFilter]   = useState("");
  const [dateFrom, setDateFrom]       = useState("");
  const [dateTo, setDateTo]           = useState("");
  const [datePreset, setDatePreset]   = useState<"all" | "today" | "week" | "month">("all");
  const [exporting, setExporting]     = useState(false);

  const hasFilter = !!(typeFilter || dateFrom || dateTo);

  const applyDatePreset = (preset: typeof datePreset) => {
    setDatePreset(preset);
    setPage(1);
    const today = new Date();
    const toStr = (d: Date) => d.toISOString().slice(0, 10);
    if (preset === "all") {
      setDateFrom(""); setDateTo("");
    } else if (preset === "today") {
      const s = toStr(today);
      setDateFrom(s); setDateTo(s);
    } else if (preset === "week") {
      const from = new Date(today);
      from.setDate(today.getDate() - 6);
      setDateFrom(toStr(from)); setDateTo(toStr(today));
    } else if (preset === "month") {
      setDateFrom(toStr(new Date(today.getFullYear(), today.getMonth(), 1)));
      setDateTo(toStr(today));
    }
  };

  const clearAll = () => {
    setTypeFilter(""); setDateFrom(""); setDateTo("");
    setDatePreset("all"); setPage(1);
  };

  const exportToExcel = async () => {
    if (!token || exporting) return;
    setExporting(true);
    try {
      const q = new URLSearchParams({ page: "1", limit: "5000" });
      if (typeFilter) q.set("type", typeFilter);
      if (dateFrom)   q.set("dateFrom", dateFrom);
      if (dateTo)     q.set("dateTo",   dateTo);
      const r = await fetch(`${BACKEND}/api/merchant/wallet/ledger?${q}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await r.json();
      const rows: WalletTx[] = d.data ?? d.docs ?? [];
      const ws = XLSX.utils.json_to_sheet(rows.map((tx) => ({
        Type:          TX_META[tx.type]?.label ?? tx.type,
        "Order ID":    tx.refModel === "Order" ? (tx.refId?.orderNumber ?? "—") : "—",
        Amount:        tx.amount,
        "Balance After": tx.balanceAfter,
        Description:   tx.description ?? "",
        Date:          fmt(tx.createdAt),
      })));
      ws["!cols"] = [{ wch: 18 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 40 }, { wch: 22 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Transactions");
      XLSX.writeFile(wb, `transactions_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch { /* silent */ } finally {
      setExporting(false);
    }
  };

  const fetchTxns = useCallback((pg: number, type: string, from: string, to: string, signal?: AbortSignal) => {
    if (!token) return;
    setLoading(true);
    const q = new URLSearchParams({ page: String(pg), limit: "15" });
    if (type) q.set("type", type);
    if (from) q.set("dateFrom", from);
    if (to)   q.set("dateTo",   to);

    fetch(`${BACKEND}/api/merchant/wallet/ledger?${q}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal,
    })
      .then((r) => r.json())
      .then((d) => {
        setTxns(d.data ?? d.docs ?? []);
        setTotalPages(d.meta?.totalPages ?? 1);
        setTotal(d.meta?.total ?? 0);
      })
      .catch((err) => { if (err.name !== "AbortError") setTxns([]); })
      .finally(() => { if (!signal?.aborted) setLoading(false); });
  }, [token]);

  useEffect(() => {
    const controller = new AbortController();
    const t = setTimeout(() => fetchTxns(page, typeFilter, dateFrom, dateTo, controller.signal), 300);
    return () => { clearTimeout(t); controller.abort(); };
  }, [page, typeFilter, dateFrom, dateTo, fetchTxns]);

  const credits = txns.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const debits  = txns.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);

  return (
    <div className="flex flex-col gap-5 w-full">

      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/15 shrink-0">
            <Activity className="h-5 w-5 text-brand" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Transactions</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {total > 0 ? `${total} total transactions` : "Your wallet transaction history"}
            </p>
          </div>
        </div>
        <button
          onClick={exportToExcel}
          disabled={exporting || txns.length === 0}
          className="flex items-center gap-2 rounded-lg border border-border bg-secondary/50 hover:bg-secondary px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors shrink-0"
        >
          {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Export Excel
        </button>
      </div>

      {/* ── Date presets + summary cards ── */}
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

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-xl border border-border bg-card p-5 flex items-center gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand/10 shrink-0">
              <Receipt className="h-5 w-5 text-brand" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Total Transactions</p>
              <p className="text-2xl font-bold font-mono mt-0.5 text-brand">{loading ? "…" : total}</p>
              {datePreset !== "all" && (
                <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                  {{ today: "Today", week: "Last 7 days", month: "This month" }[datePreset]}
                </p>
              )}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-5 flex items-center gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-yes/10 shrink-0">
              <TrendingUp className="h-5 w-5 text-yes" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Credits</p>
              <p className="text-2xl font-bold font-mono mt-0.5 text-yes">
                {loading ? "…" : `+$${credits.toFixed(2)}`}
              </p>
              <p className="text-[10px] text-muted-foreground/60 mt-0.5">Current page</p>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-5 flex items-center gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-no/10 shrink-0">
              <TrendingDown className="h-5 w-5 text-no" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Debits</p>
              <p className="text-2xl font-bold font-mono mt-0.5 text-no">
                {loading ? "…" : `-$${debits.toFixed(2)}`}
              </p>
              <p className="text-[10px] text-muted-foreground/60 mt-0.5">Current page</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="rounded-xl border border-border bg-card px-4 py-3">
        <div className="flex flex-wrap gap-2 items-center">
          {/* Type filter */}
          <select
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
            className="rounded-md border border-border bg-secondary/40 px-2.5 h-8 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-brand/50 focus:border-brand/50 transition-colors w-44"
          >
            <option value="">All Types</option>
            {ALL_TYPES.map((t) => (
              <option key={t} value={t}>{TX_META[t].label}</option>
            ))}
          </select>

          {/* Date range */}
          <div className="flex items-center gap-1">
            <input
              type="date" value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setDatePreset("all"); setPage(1); }}
              className="rounded-md border border-border bg-secondary/40 px-2 h-8 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-brand/50 focus:border-brand/50 transition-colors"
            />
            <span className="text-muted-foreground text-xs">–</span>
            <input
              type="date" value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setDatePreset("all"); setPage(1); }}
              className="rounded-md border border-border bg-secondary/40 px-2 h-8 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-brand/50 focus:border-brand/50 transition-colors"
            />
          </div>

          {/* Clear */}
          {hasFilter && (
            <button onClick={clearAll}
              className="flex items-center gap-1 rounded-md border border-border bg-secondary/40 px-2.5 h-8 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors whitespace-nowrap">
              <X className="h-3 w-3" /> Clear
            </button>
          )}
        </div>
      </div>

      {/* ── Table ── */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <p className="text-sm font-semibold text-foreground">Transaction History</p>
          {total > 0 && (
            <span className="rounded-full bg-brand/15 text-brand text-xs font-semibold px-3 py-1">
              {total} transactions
            </span>
          )}
        </div>

        {loading ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-border/60">
                {Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-4 py-3.5"><div className="h-3.5 w-6 rounded bg-secondary" /></td>
                    <td className="px-4 py-3.5"><div className="h-6 w-28 rounded-lg bg-secondary" /></td>
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
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary">
              <Activity className="h-7 w-7 text-muted-foreground/40" />
            </div>
            <div>
              <p className="text-base font-semibold text-foreground">
                {hasFilter ? "No transactions match the filters" : "No transactions yet"}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {hasFilter ? "" : "Wallet activity will appear here"}
              </p>
            </div>
            {hasFilter && (
              <button onClick={clearAll} className="text-xs text-brand hover:underline">Clear filters</button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/30">
                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground w-10">#</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Type</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Order ID</th>
                    <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Amount</th>
                    <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Balance After</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Description</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {txns.map((tx, idx) => {
                    const meta = TX_META[tx.type] ?? { label: tx.type.replace(/_/g, " "), color: "text-foreground", bg: "bg-secondary", icon: Receipt };
                    const isCredit = tx.amount > 0;
                    return (
                      <tr key={tx._id} className="hover:bg-secondary/20 transition-colors">
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {(page - 1) * 15 + idx + 1}
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
                        <td className="px-4 py-3 max-w-xs">
                          <p className="truncate text-sm text-muted-foreground">{tx.description || "—"}</p>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                          {fmt(tx.createdAt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-secondary/10">
              <span className="text-sm text-muted-foreground">
                Page <span className="font-semibold text-foreground">{page}</span> of{" "}
                <span className="font-semibold text-foreground">{totalPages}</span>
              </span>
              <div className="flex items-center gap-2">
                <button onClick={() => setPage((p) => p - 1)} disabled={page <= 1}
                  className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-40 transition-colors">
                  <ChevronLeft className="h-4 w-4" /> Prev
                </button>
                <button onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages}
                  className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-40 transition-colors">
                  Next <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
