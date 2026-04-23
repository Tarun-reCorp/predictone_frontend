"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ShoppingBag, ChevronLeft, ChevronRight,
  Hash, DollarSign, CheckCheck, Timer, Loader2, Search, X, Download,
} from "lucide-react";
import * as XLSX from "xlsx";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface Order {
  _id: string;
  orderNumber?: string;
  conditionId: string;
  marketQuestion?: string;
  outcome: "Yes" | "No";
  amount: number;
  price?: number;
  status: "pending" | "submitted" | "matched" | "settled" | "failed" | "cancelled";
  createdAt: string;
}

const STATUS_STYLE: Record<string, string> = {
  pending:   "bg-chart-4/15 text-chart-4",
  submitted: "bg-blue-500/15 text-blue-400",
  matched:   "bg-brand/15 text-brand",
  settled:   "bg-yes/15 text-yes",
  failed:    "bg-no/15 text-no",
  cancelled: "bg-muted-foreground/15 text-muted-foreground",
};

const ALL_STATUSES = ["pending", "submitted", "matched", "settled", "failed", "cancelled"];

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
  outcome:        string;
  status:         string;
  minAmount:      string;
  maxAmount:      string;
  dateFrom:       string;
  dateTo:         string;
}

const EMPTY: Filters = {
  marketQuestion: "", orderNumber: "",
  outcome: "", status: "", minAmount: "", maxAmount: "",
  dateFrom: "", dateTo: "",
};

function buildFilterParams(f: Filters, extra: Record<string, string> = {}): URLSearchParams {
  const q = new URLSearchParams(extra);
  if (f.marketQuestion) q.set("marketQuestion", f.marketQuestion);
  if (f.orderNumber)    q.set("orderNumber",    f.orderNumber);
  if (f.outcome)        q.set("outcome",        f.outcome);
  if (f.status)         q.set("status",         f.status);
  if (f.minAmount)      q.set("minAmount",      f.minAmount);
  if (f.maxAmount)      q.set("maxAmount",      f.maxAmount);
  if (f.dateFrom)       q.set("dateFrom",       f.dateFrom);
  if (f.dateTo)         q.set("dateTo",         f.dateTo);
  return q;
}

export default function MerchantOrdersPage() {
  const { token } = useAuth();

  const [orders, setOrders]         = useState<Order[]>([]);
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

    fetch(`${BACKEND}/api/orders/my-orders?${q}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal,
    })
      .then((r) => r.json())
      .then((data) => {
        const list = data.docs ?? data.data ?? [];
        setOrders(list);
        setTotalPages(data.totalPages ?? data.meta?.totalPages ?? 1);
        setTotal(data.total ?? data.meta?.total ?? list.length);
      })
      .catch((err) => { if (err.name !== "AbortError") setOrders([]); })
      .finally(() => { if (!signal?.aborted) setLoading(false); });
  }, [token]);

  useEffect(() => {
    const controller = new AbortController();
    const t = setTimeout(() => fetchOrders(page, filters, controller.signal), 400);
    return () => { clearTimeout(t); controller.abort(); };
  }, [page, filters, fetchOrders]);

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
      const res  = await fetch(`${BACKEND}/api/orders/my-orders?${q}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      const rows: Order[] = data.docs ?? data.data ?? [];

      const sheet = rows.map((o, i) => ({
        "#":          i + 1,
        "Order ID":   o.orderNumber ?? o._id.slice(-8).toUpperCase(),
        "Market":     o.marketQuestion ?? o.conditionId,
        "Outcome":    o.outcome,
        "Amount ($)": o.amount,
        "Status":     o.status,
        "Date":       new Date(o.createdAt).toLocaleString("en-IN"),
      }));

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(sheet);
      ws["!cols"] = [
        { wch: 5 }, { wch: 14 }, { wch: 44 }, { wch: 9 }, { wch: 12 }, { wch: 12 }, { wch: 22 },
      ];
      XLSX.utils.book_append_sheet(wb, ws, "My Orders");
      XLSX.writeFile(wb, `my_orders_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch {
      // silent fail
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 w-full">

      {/* ── Page heading ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/15 shrink-0">
            <ShoppingBag className="h-5 w-5 text-brand" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Orders</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {total > 0 ? `${total} total orders` : "Your order history"}
            </p>
          </div>
        </div>
        <button
          onClick={exportToExcel}
          disabled={exporting || total === 0}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-secondary/50 hover:bg-secondary px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors"
        >
          {exporting
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <Download className="h-3.5 w-3.5" />}
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

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard icon={Hash}       label="Total Orders"  value={String(total)}
            accent="text-brand"   bg="bg-brand/10"
            sub={datePreset !== "all" ? { today: "Today", week: "Last 7 days", month: "This month" }[datePreset] : undefined} />
          <SummaryCard icon={DollarSign} label="Volume"
            value={loading ? "…" : fmtAmt(orders.reduce((s, o) => s + o.amount, 0))}
            accent="text-chart-4" bg="bg-chart-4/10" sub="Current page" />
          <SummaryCard icon={CheckCheck} label="Settled"
            value={loading ? "…" : String(orders.filter((o) => o.status === "settled").length)}
            accent="text-yes"     bg="bg-yes/10" sub="Current page" />
          <SummaryCard icon={Timer}      label="Pending"
            value={loading ? "…" : String(orders.filter((o) => ["pending", "submitted"].includes(o.status)).length)}
            accent="text-chart-4" bg="bg-chart-4/10" sub="Current page" />
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="rounded-xl border border-border bg-card px-4 py-3">
        <div className="flex flex-wrap gap-2">
          {/* Market search */}
          <div className="relative flex-1 min-w-[160px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
            <input value={filters.marketQuestion} onChange={set("marketQuestion")}
              placeholder="Search market"
              className="w-full rounded-md border border-border bg-secondary/40 pl-7 pr-2.5 h-8 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-brand/50 focus:border-brand/50 transition-colors" />
          </div>

          {/* Order ID */}
          <div className="relative w-40">
            <input value={filters.orderNumber} onChange={set("orderNumber")}
              placeholder="Order ID"
              className="w-full rounded-md border border-border bg-secondary/40 px-2.5 h-8 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-brand/50 focus:border-brand/50 font-mono transition-colors" />
          </div>

          {/* Outcome */}
          <select value={filters.outcome} onChange={set("outcome")}
            className="rounded-md border border-border bg-secondary/40 px-2.5 h-8 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-brand/50 focus:border-brand/50 transition-colors w-32">
            <option value="">Outcome</option>
            <option value="Yes">Yes</option>
            <option value="No">No</option>
          </select>

          {/* Status */}
          <select value={filters.status} onChange={set("status")}
            className="rounded-md border border-border bg-secondary/40 px-2.5 h-8 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-brand/50 focus:border-brand/50 transition-colors w-36">
            <option value="">Status</option>
            {ALL_STATUSES.map((s) => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>

          {/* Amount range */}
          <div className="flex items-center gap-1">
            <input value={filters.minAmount} onChange={set("minAmount")} type="number" min="0"
              placeholder="Min $"
              className="w-20 rounded-md border border-border bg-secondary/40 px-2.5 h-8 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-brand/50 focus:border-brand/50 transition-colors" />
            <span className="text-muted-foreground text-xs">–</span>
            <input value={filters.maxAmount} onChange={set("maxAmount")} type="number" min="0"
              placeholder="Max $"
              className="w-20 rounded-md border border-border bg-secondary/40 px-2.5 h-8 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-brand/50 focus:border-brand/50 transition-colors" />
          </div>

          {/* Date range */}
          <div className="flex items-center gap-1">
            <input type="date" value={filters.dateFrom} onChange={set("dateFrom")}
              className="rounded-md border border-border bg-secondary/40 px-2 h-8 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-brand/50 focus:border-brand/50 transition-colors" />
            <span className="text-muted-foreground text-xs">–</span>
            <input type="date" value={filters.dateTo} onChange={set("dateTo")}
              className="rounded-md border border-border bg-secondary/40 px-2 h-8 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-brand/50 focus:border-brand/50 transition-colors" />
          </div>

          {/* Clear */}
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
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <p className="text-sm font-semibold text-foreground">Order History</p>
          {total > 0 && (
            <span className="rounded-full bg-brand/15 text-brand text-xs font-semibold px-3 py-1">
              {total} orders
            </span>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary">
              <ShoppingBag className="h-7 w-7 text-muted-foreground/40" />
            </div>
            <div>
              <p className="text-base font-semibold text-foreground">
                {activeCount > 0 ? "No orders match the applied filters" : "No orders yet"}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {activeCount > 0 ? "" : "Your placed orders will appear here"}
              </p>
            </div>
            {activeCount > 0 && (
              <button onClick={clearAll} className="text-xs text-brand hover:underline">Clear filters</button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/30">
                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground w-12">#</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Order ID</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Market</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Outcome</th>
                    <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Amount</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {orders.map((o, idx) => (
                    <tr key={o._id} className="hover:bg-secondary/20 transition-colors group">
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {(page - 1) * 10 + idx + 1}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-mono font-semibold text-brand bg-brand/10 rounded px-2 py-1">
                          {o.orderNumber ?? o._id.slice(-8).toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        <p className="truncate text-sm font-medium text-foreground group-hover:text-brand transition-colors">
                          {o.marketQuestion || o.conditionId.slice(0, 20) + "…"}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
                          o.outcome === "Yes" ? "bg-yes/15 text-yes" : "bg-no/15 text-no"
                        )}>
                          {o.outcome}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm font-semibold font-mono text-foreground">{fmtAmt(o.amount)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold capitalize",
                          STATUS_STYLE[o.status] ?? "bg-secondary text-muted-foreground"
                        )}>
                          {o.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                        {fmt(o.createdAt)}
                      </td>
                    </tr>
                  ))}
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

function SummaryCard({ icon: Icon, label, value, accent, bg, sub }: {
  icon: React.ElementType; label: string; value: string;
  accent: string; bg: string; sub?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 flex items-center gap-4">
      <div className={cn("flex h-11 w-11 items-center justify-center rounded-xl shrink-0", bg)}>
        <Icon className={cn("h-5 w-5", accent)} />
      </div>
      <div>
        <p className="text-xs text-muted-foreground font-medium">{label}</p>
        <p className={cn("text-2xl font-bold font-mono mt-0.5 tracking-tight", accent)}>{value}</p>
        {sub && <p className="text-[10px] text-muted-foreground/60 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function Pagination({ page, totalPages, onChange }: {
  page: number; totalPages: number; onChange: (p: number) => void;
}) {
  return (
    <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-secondary/10">
      <span className="text-sm text-muted-foreground">
        Page <span className="font-semibold text-foreground">{page}</span> of{" "}
        <span className="font-semibold text-foreground">{totalPages}</span>
      </span>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-40 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" /> Prev
        </button>
        <button
          onClick={() => onChange(page + 1)}
          disabled={page >= totalPages}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-40 transition-colors"
        >
          Next <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
