"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ShoppingBag, ChevronLeft, ChevronRight,
  Hash, DollarSign, CheckCheck, Timer, XCircle, Loader2, Search, X, Download,
  TrendingUp, TrendingDown, RotateCcw,
} from "lucide-react";
import * as XLSX from "xlsx";

import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface AdminOrder {
  _id: string;
  orderNumber?: string;
  userId?: { _id?: string; name?: string; email?: string } | string;
  conditionId: string;
  marketQuestion?: string;
  outcome: "Yes" | "No";
  amount: number;
  payout?: number | null;
  result?: "won" | "lost" | "refunded" | null;
  status: "active" | "settled" | "failed" | "cancelled";
  createdAt: string;
}

const STATUS_STYLE: Record<string, string> = {
  active:    "bg-brand/15 text-brand",
  settled:   "bg-yes/15 text-yes",
  failed:    "bg-no/15 text-no",
  cancelled: "bg-muted-foreground/15 text-muted-foreground",
};

const ALL_STATUSES = ["active", "settled", "failed", "cancelled"];

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}
function fmtAmt(n: number) { return `$${n.toFixed(2)}`; }

interface Filters {
  marketQuestion: string;
  orderNumber:    string;
  merchantSearch: string;
  outcome:        string;
  status:         string;
  minAmount:      string;
  maxAmount:      string;
  dateFrom:       string;
  dateTo:         string;
}

const EMPTY: Filters = {
  marketQuestion: "", orderNumber: "", merchantSearch: "",
  outcome: "", status: "", minAmount: "", maxAmount: "",
  dateFrom: "", dateTo: "",
};

function buildFilterParams(f: Filters, extra: Record<string, string> = {}): URLSearchParams {
  const q = new URLSearchParams(extra);
  if (f.marketQuestion) q.set("marketQuestion", f.marketQuestion);
  if (f.orderNumber)    q.set("orderNumber",    f.orderNumber);
  if (f.merchantSearch) q.set("merchantSearch", f.merchantSearch);
  if (f.outcome)        q.set("outcome",        f.outcome);
  if (f.status)         q.set("status",         f.status);
  if (f.minAmount)      q.set("minAmount",      f.minAmount);
  if (f.maxAmount)      q.set("maxAmount",      f.maxAmount);
  if (f.dateFrom)       q.set("dateFrom",       f.dateFrom);
  if (f.dateTo)         q.set("dateTo",         f.dateTo);
  return q;
}

export default function AdminOrdersPage() {
  const { token } = useAuth();

  const [orders, setOrders]         = useState<AdminOrder[]>([]);
  const [loading, setLoading]       = useState(true);
  const [page, setPage]             = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal]           = useState(0);
  const [filters, setFilters]       = useState<Filters>(EMPTY);
  const [tablePreset, setTablePreset] = useState<"all" | "today" | "week" | "month">("all");
  const [exporting, setExporting]   = useState(false);

  const [stats, setStats]           = useState({ total: 0, volume: 0, settled: 0, pending: 0, cancelled: 0 });
  const [statsLoading, setStatsLoading] = useState(true);

  const activeCount = Object.values(filters).filter((v) => v !== "").length;

  const applyTablePreset = (preset: typeof tablePreset) => {
    setTablePreset(preset);
    setPage(1);
    const today = new Date();
    const toStr = (d: Date) => d.toISOString().slice(0, 10);
    if (preset === "all") {
      setFilters((f) => ({ ...f, dateFrom: "", dateTo: "" }));
    } else if (preset === "today") {
      const s = toStr(today);
      setFilters((f) => ({ ...f, dateFrom: s, dateTo: s }));
    } else if (preset === "week") {
      const from = new Date(today);
      from.setDate(today.getDate() - 6);
      setFilters((f) => ({ ...f, dateFrom: toStr(from), dateTo: toStr(today) }));
    } else if (preset === "month") {
      const from = new Date(today.getFullYear(), today.getMonth(), 1);
      setFilters((f) => ({ ...f, dateFrom: toStr(from), dateTo: toStr(today) }));
    }
  };

  const fetchOrders = useCallback((pageNum: number, f: Filters, signal?: AbortSignal) => {
    if (!token) return;
    setLoading(true);
    const q = buildFilterParams(f, { page: String(pageNum), limit: "10" });

    fetch(`${BACKEND}/api/admin/orders?${q}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal,
    })
      .then((r) => r.json())
      .then((data) => {
        setOrders(data.data ?? data.docs ?? []);
        setTotalPages(data.meta?.totalPages ?? data.totalPages ?? 1);
        setTotal(data.meta?.total ?? data.total ?? 0);
      })
      .catch((err) => { if (err.name !== "AbortError") setOrders([]); })
      .finally(() => { if (!signal?.aborted) setLoading(false); });
  }, [token]);

  useEffect(() => {
    const controller = new AbortController();
    const t = setTimeout(() => fetchOrders(page, filters, controller.signal), 400);
    return () => { clearTimeout(t); controller.abort(); };
  }, [page, filters, fetchOrders]);

  useEffect(() => {
    if (!token) return;
    setStatsLoading(true);
    fetch(`${BACKEND}/api/admin/orders/stats`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => {
        if (!r.ok) throw new Error(`Stats API error: ${r.status}`);
        return r.json();
      })
      .then((d) => {
        const s = d.data;
        if (s && typeof s === "object") {
          setStats({
            total:     Number(s.total     ?? 0),
            volume:    Number(s.volume    ?? 0),
            settled:   Number(s.settled   ?? 0),
            pending:   Number(s.pending   ?? 0),
            cancelled: Number(s.cancelled ?? 0),
          });
        }
      })
      .catch((e) => console.error("[OrderStats]", e))
      .finally(() => setStatsLoading(false));
  }, [token]);

  const set = (key: keyof Filters) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setPage(1);
      if (key === "dateFrom" || key === "dateTo") setTablePreset("all");
      setFilters((f) => ({ ...f, [key]: e.target.value }));
    };

  const clearAll = () => { setFilters(EMPTY); setPage(1); setTablePreset("all"); };

  const exportToExcel = async () => {
    if (!token) return;
    setExporting(true);
    try {
      const q = buildFilterParams(filters, { page: "1", limit: "5000" });
      const res  = await fetch(`${BACKEND}/api/admin/orders?${q}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      const rows: AdminOrder[] = data.data ?? data.docs ?? [];

      const sheet = rows.map((o, i) => {
        const merchant = typeof o.userId === "object" ? o.userId : null;
        const profit = o.result === "won"
          ? parseFloat(((o.payout ?? 0) - o.amount).toFixed(2))
          : o.result === "lost" ? -o.amount
          : null;
        const marketResolved =
          o.result === "won"  ? o.outcome :
          o.result === "lost" ? (o.outcome === "Yes" ? "No" : "Yes") : "";
        return {
          "#":               i + 1,
          "Order ID":        o.orderNumber ?? o._id.slice(-8).toUpperCase(),
          "Merchant":        merchant?.name ?? "—",
          "Email":           merchant?.email ?? "—",
          "Market":          o.marketQuestion ?? o.conditionId,
          "Bet Placed":      o.outcome,
          "Staked ($)":      o.amount,
          "Payout ($)":      o.payout ?? "",
          "P&L ($)":         profit ?? "",
          "Market Resolved": marketResolved,
          "Result":          o.result ?? "",
          "Status":          o.status,
          "Date":            new Date(o.createdAt).toLocaleString("en-IN"),
        };
      });

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(sheet);
      ws["!cols"] = [
        { wch: 5 }, { wch: 14 }, { wch: 20 }, { wch: 26 },
        { wch: 42 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 16 }, { wch: 12 }, { wch: 12 }, { wch: 22 },
      ];
      XLSX.utils.book_append_sheet(wb, ws, "Orders");
      XLSX.writeFile(wb, `orders_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch {
      // silent fail
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">

      {/* ── Page heading ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShoppingBag className="h-5 w-5 text-brand" />
          <h1 className="text-xl font-bold text-foreground">All Orders</h1>
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

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <SummaryCard icon={Hash}       label="Total Orders"
          value={statsLoading ? "…" : String(stats.total)}
          accent="text-brand"   bg="bg-brand/10" />
        <SummaryCard icon={DollarSign} label="Volume"
          value={statsLoading ? "…" : fmtAmt(stats.volume)}
          accent="text-chart-4" bg="bg-chart-4/10" />
        <SummaryCard icon={CheckCheck} label="Settled"
          value={statsLoading ? "…" : String(stats.settled)}
          accent="text-yes"     bg="bg-yes/10" />
        <SummaryCard icon={Timer}      label="Active"
          value={statsLoading ? "…" : String(stats.pending)}
          accent="text-chart-4" bg="bg-chart-4/10" />
        <SummaryCard icon={XCircle}    label="Cancelled"
          value={statsLoading ? "…" : String(stats.cancelled)}
          accent="text-muted-foreground" bg="bg-muted-foreground/10" />
      </div>

      {/* ── Table date presets ── */}
      <div className="flex items-center gap-1.5">
        {(["all", "today", "week", "month"] as const).map((p) => {
          const label = { all: "All Time", today: "Today", week: "Last 7 Days", month: "This Month" }[p];
          return (
            <button key={p} onClick={() => applyTablePreset(p)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium border transition-colors",
                tablePreset === p
                  ? "bg-brand text-white border-brand"
                  : "bg-secondary/50 text-muted-foreground border-border hover:text-foreground hover:bg-secondary"
              )}>
              {label}
            </button>
          );
        })}
      </div>

      {/* ── Filters ── */}
      <div className="rounded-xl border border-border bg-card px-4 py-3 space-y-2.5">
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[160px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
            <input value={filters.marketQuestion} onChange={set("marketQuestion")}
              placeholder="Search market"
              className="w-full rounded-md border border-border bg-secondary/40 pl-7 pr-2.5 h-8 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-brand/50 focus:border-brand/50 transition-colors" />
          </div>

          <div className="relative w-40">
            <input value={filters.orderNumber} onChange={set("orderNumber")}
              placeholder="Order ID"
              className="w-full rounded-md border border-border bg-secondary/40 px-2.5 h-8 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-brand/50 focus:border-brand/50 font-mono transition-colors" />
          </div>

          <div className="relative flex-1 min-w-[140px]">
            <input value={filters.merchantSearch} onChange={set("merchantSearch")}
              placeholder="Merchant name / email"
              className="w-full rounded-md border border-border bg-secondary/40 px-2.5 h-8 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-brand/50 focus:border-brand/50 transition-colors" />
          </div>

          <select value={filters.outcome} onChange={set("outcome")}
            className="rounded-md border border-border bg-secondary/40 px-2.5 h-8 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-brand/50 focus:border-brand/50 transition-colors w-32">
            <option value="">Bet Placed</option>
            <option value="Yes">Yes</option>
            <option value="No">No</option>
          </select>

          <select value={filters.status} onChange={set("status")}
            className="rounded-md border border-border bg-secondary/40 px-2.5 h-8 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-brand/50 focus:border-brand/50 transition-colors w-36">
            <option value="">Status</option>
            {ALL_STATUSES.map((s) => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>

          <div className="flex items-center gap-1">
            <input value={filters.minAmount} onChange={set("minAmount")} type="number" min="0"
              placeholder="Min $"
              className="w-20 rounded-md border border-border bg-secondary/40 px-2.5 h-8 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-brand/50 focus:border-brand/50 transition-colors" />
            <span className="text-muted-foreground text-xs">–</span>
            <input value={filters.maxAmount} onChange={set("maxAmount")} type="number" min="0"
              placeholder="Max $"
              className="w-20 rounded-md border border-border bg-secondary/40 px-2.5 h-8 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-brand/50 focus:border-brand/50 transition-colors" />
          </div>

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
                    <td className="px-4 py-3.5"><div className="h-3.5 w-24 rounded bg-secondary" /></td>
                    <td className="px-4 py-3.5"><div className="h-3.5 w-28 rounded bg-secondary" /></td>
                    <td className="px-4 py-3.5"><div className="h-3.5 w-48 rounded bg-secondary" /></td>
                    <td className="px-4 py-3.5"><div className="h-6 w-16 rounded-full bg-secondary" /></td>
                    <td className="px-4 py-3.5"><div className="h-3.5 w-16 rounded bg-secondary" /></td>
                    <td className="px-4 py-3.5"><div className="h-3.5 w-20 rounded bg-secondary" /></td>
                    <td className="px-4 py-3.5"><div className="h-6 w-16 rounded-full bg-secondary" /></td>
                    <td className="px-4 py-3.5"><div className="h-3.5 w-24 rounded bg-secondary" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
            <ShoppingBag className="h-9 w-9 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">
              {activeCount > 0 ? "No orders match the applied filters" : "No orders found"}
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
                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground w-10">#</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Order ID</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Merchant</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Market</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Bet Placed</th>
                    <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Staked</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Settlement & P&L</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {orders.map((o, idx) => {
                    const merchant = typeof o.userId === "object" ? o.userId : null;
                    return (
                      <tr key={o._id} className="hover:bg-secondary/20 transition-colors">
                        <td className="px-4 py-3 text-sm text-muted-foreground">{(page - 1) * 10 + idx + 1}</td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-mono font-semibold text-brand bg-brand/10 rounded px-2 py-1">
                            {o.orderNumber ?? o._id.slice(-8).toUpperCase()}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium text-foreground">{merchant?.name ?? "—"}</p>
                          {merchant?.email && <p className="text-xs text-muted-foreground">{merchant.email}</p>}
                        </td>
                        <td className="px-4 py-3 max-w-[180px]">
                          <p className="truncate text-sm text-foreground font-medium">
                            {o.marketQuestion || o.conditionId.slice(0, 16) + "…"}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] text-muted-foreground/60 font-medium">Bought</span>
                            <span className={cn(
                              "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold w-fit",
                              o.outcome === "Yes" ? "bg-yes/15 text-yes" : "bg-no/15 text-no"
                            )}>
                              {o.outcome === "Yes"
                                ? <TrendingUp className="h-3 w-3" />
                                : <TrendingDown className="h-3 w-3" />}
                              {o.outcome}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-sm font-semibold font-mono text-foreground">{fmtAmt(o.amount)}</span>
                        </td>
                        <td className="px-4 py-3">
                          <OrderResultCell order={o} />
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn(
                            "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold capitalize",
                            STATUS_STYLE[o.status] ?? "bg-secondary text-muted-foreground"
                          )}>{o.status}</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">{fmt(o.createdAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalPages={totalPages} onChange={setPage} />
          </>
        )}
      </div>
    </div>
  );
}

function OrderResultCell({ order }: { order: AdminOrder }) {
  if (order.status !== "settled") {
    return <span className="text-xs text-muted-foreground/50">—</span>;
  }

  const { result, payout, amount, outcome } = order;

  const marketResolved: "Yes" | "No" | null =
    result === "won"  ? outcome :
    result === "lost" ? (outcome === "Yes" ? "No" : "Yes") :
    null;

  if (result === "won") {
    const profit = parseFloat(((payout ?? 0) - amount).toFixed(2));
    return (
      <div className="flex flex-col gap-1">
        <span className="inline-flex items-center gap-1 rounded-full bg-yes/15 text-yes px-2.5 py-1 text-xs font-bold w-fit">
          <TrendingUp className="h-3 w-3" /> You Won
        </span>
        <span className="text-[10px] text-muted-foreground pl-0.5">
          Market resolved → <span className="font-semibold text-yes">{marketResolved}</span>
        </span>
        <span className="text-xs font-mono text-yes font-semibold pl-0.5">
          Payout: +{fmtAmt(payout ?? 0)}{" "}
          <span className="text-yes/70">(+{fmtAmt(profit)} profit)</span>
        </span>
      </div>
    );
  }

  if (result === "lost") {
    return (
      <div className="flex flex-col gap-1">
        <span className="inline-flex items-center gap-1 rounded-full bg-no/15 text-no px-2.5 py-1 text-xs font-bold w-fit">
          <TrendingDown className="h-3 w-3" /> You Lost
        </span>
        <span className="text-[10px] text-muted-foreground pl-0.5">
          Market resolved → <span className="font-semibold text-no">{marketResolved}</span>
        </span>
        <span className="text-xs font-mono text-no font-semibold pl-0.5">
          Lost: -{fmtAmt(amount)}{" "}
          <span className="text-no/70">(stake lost)</span>
        </span>
      </div>
    );
  }

  if (result === "refunded") {
    return (
      <div className="flex flex-col gap-1">
        <span className="inline-flex items-center gap-1 rounded-full bg-muted-foreground/15 text-muted-foreground px-2.5 py-1 text-xs font-bold w-fit">
          <RotateCcw className="h-3 w-3" /> Refunded
        </span>
        <span className="text-[10px] text-muted-foreground pl-0.5">Market cancelled / Draw</span>
        <span className="text-xs font-mono text-muted-foreground font-semibold pl-0.5">
          Returned: {fmtAmt(payout ?? amount)}
        </span>
      </div>
    );
  }

  return <span className="text-xs text-muted-foreground/50">Settled</span>;
}

function SummaryCard({ icon: Icon, label, value, accent, bg }: {
  icon: React.ElementType; label: string; value: string;
  accent: string; bg: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
      <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg shrink-0", bg)}>
        <Icon className={cn("h-4 w-4", accent)} />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={cn("text-lg font-bold font-mono mt-0.5", accent)}>{value}</p>
      </div>
    </div>
  );
}

function Pagination({ page, totalPages, onChange }: {
  page: number; totalPages: number; onChange: (p: number) => void;
}) {
  return (
    <div className="flex items-center justify-between px-5 py-3 border-t border-border">
      <span className="text-xs text-muted-foreground">Page {page} of {totalPages}</span>
      <div className="flex items-center gap-1">
        <button onClick={() => onChange(page - 1)} disabled={page <= 1}
          className="flex items-center gap-1 rounded border border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-40 transition-colors">
          <ChevronLeft className="h-3.5 w-3.5" /> Prev
        </button>
        <button onClick={() => onChange(page + 1)} disabled={page >= totalPages}
          className="flex items-center gap-1 rounded border border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-40 transition-colors">
          Next <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
