"use client";

import { useState, useEffect } from "react";
import {
  ShoppingBag, ChevronLeft, ChevronRight,
  Hash, DollarSign, CheckCheck, Timer, Loader2,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface Order {
  _id: string;
  conditionId: string;
  marketQuestion: string;
  outcome: "Yes" | "No";
  side: "buy" | "sell";
  amount: number;
  price: number;
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

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}
function fmtAmt(n: number) { return `$${n.toFixed(2)}`; }

export default function MerchantOrdersPage() {
  const { token } = useAuth();

  const [orders, setOrders]         = useState<Order[]>([]);
  const [loading, setLoading]       = useState(true);
  const [page, setPage]             = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal]           = useState(0);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    fetch(`${BACKEND}/api/orders/my-orders?page=${page}&limit=10`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        const list = data.docs ?? data.data ?? [];
        setOrders(list);
        setTotalPages(data.totalPages ?? data.meta?.totalPages ?? 1);
        setTotal(data.total ?? data.meta?.total ?? list.length);
      })
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }, [token, page]);

  return (
    <div className="flex flex-col gap-6 w-full">

      {/* ── Page header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
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
      </div>

      {/* ── Summary cards ── */}
      {!loading && orders.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard icon={Hash}       label="Total Orders"  value={String(total)}
            accent="text-brand"   bg="bg-brand/10" />
          <SummaryCard icon={DollarSign} label="Page Volume"
            value={fmtAmt(orders.reduce((s, o) => s + o.amount, 0))}
            accent="text-chart-4" bg="bg-chart-4/10" />
          <SummaryCard icon={CheckCheck} label="Settled"
            value={String(orders.filter((o) => o.status === "settled").length)}
            accent="text-yes"     bg="bg-yes/10" />
          <SummaryCard icon={Timer}      label="Pending"
            value={String(orders.filter((o) => o.status === "pending" || o.status === "submitted").length)}
            accent="text-chart-4" bg="bg-chart-4/10" />
        </div>
      )}

      {/* ── Table ── */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">

        {/* Table header bar */}
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
              <p className="text-base font-semibold text-foreground">No orders yet</p>
              <p className="text-sm text-muted-foreground mt-1">Your placed orders will appear here</p>
            </div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-secondary/30">
                    <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground w-12">#</th>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Market</th>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Outcome</th>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Side</th>
                    <th className="px-6 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Amount</th>
                    <th className="px-6 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Price</th>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {orders.map((o, idx) => (
                    <tr key={o._id} className="hover:bg-secondary/20 transition-colors group">
                      <td className="px-6 py-4 text-sm text-muted-foreground font-mono">
                        {(page - 1) * 10 + idx + 1}
                      </td>
                      <td className="px-6 py-4 max-w-xs">
                        <p className="truncate text-sm font-medium text-foreground group-hover:text-brand transition-colors">
                          {o.marketQuestion || o.conditionId.slice(0, 20) + "…"}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
                          o.outcome === "Yes" ? "bg-yes/15 text-yes" : "bg-no/15 text-no"
                        )}>
                          {o.outcome}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold capitalize",
                          o.side === "buy" ? "bg-yes/10 text-yes" : "bg-no/10 text-no"
                        )}>
                          {o.side}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="text-sm font-semibold font-mono text-foreground">{fmtAmt(o.amount)}</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="text-sm font-mono text-muted-foreground">${o.price.toFixed(2)}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold capitalize",
                          STATUS_STYLE[o.status] ?? "bg-secondary text-muted-foreground"
                        )}>
                          {o.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground whitespace-nowrap">
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

// ── Shared components ──────────────────────────────────────────────────────────

function SummaryCard({ icon: Icon, label, value, accent, bg }: {
  icon: React.ElementType; label: string; value: string; accent: string; bg: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 flex items-center gap-4">
      <div className={cn("flex h-11 w-11 items-center justify-center rounded-xl shrink-0", bg)}>
        <Icon className={cn("h-5 w-5", accent)} />
      </div>
      <div>
        <p className="text-xs text-muted-foreground font-medium">{label}</p>
        <p className={cn("text-2xl font-bold font-mono mt-0.5 tracking-tight", accent)}>{value}</p>
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
