"use client";

import { useState, useEffect } from "react";
import {
  ArrowUpDown, ChevronLeft, ChevronRight,
  Receipt, DollarSign, CheckCheck, XCircle, Loader2,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface Transaction {
  _id: string;
  type: string;
  amount: number;
  currency: string;
  status: "pending" | "confirmed" | "failed";
  description?: string;
  createdAt: string;
}

const STATUS_STYLE: Record<string, string> = {
  pending:   "bg-chart-4/15 text-chart-4",
  confirmed: "bg-yes/15 text-yes",
  failed:    "bg-no/15 text-no",
};

const TYPE_STYLE: Record<string, string> = {
  order_placed:    "bg-brand/10 text-brand",
  order_settled:   "bg-yes/10 text-yes",
  order_cancelled: "bg-muted-foreground/10 text-muted-foreground",
  fee:             "bg-chart-4/10 text-chart-4",
};

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}
function fmtAmt(n: number) { return `$${n.toFixed(2)}`; }

export default function MerchantTransactionsPage() {
  const { token } = useAuth();

  const [txns, setTxns]             = useState<Transaction[]>([]);
  const [loading, setLoading]       = useState(true);
  const [page, setPage]             = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal]           = useState(0);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    fetch(`${BACKEND}/api/merchant/transactions?page=${page}&limit=10`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        const list = data.data ?? data.docs ?? [];
        setTxns(list);
        setTotalPages(data.meta?.totalPages ?? data.totalPages ?? 1);
        setTotal(data.meta?.total ?? data.total ?? list.length);
      })
      .catch(() => setTxns([]))
      .finally(() => setLoading(false));
  }, [token, page]);

  return (
    <div className="flex flex-col gap-6 w-full">

      {/* ── Page header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/15 shrink-0">
            <ArrowUpDown className="h-5 w-5 text-brand" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Transactions</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {total > 0 ? `${total} total transactions` : "Your transaction history"}
            </p>
          </div>
        </div>
      </div>

      {/* ── Summary cards ── */}
      {!loading && txns.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard icon={Receipt}    label="Total Txns"  value={String(total)}
            accent="text-brand"   bg="bg-brand/10" />
          <SummaryCard icon={DollarSign} label="Page Volume"
            value={fmtAmt(txns.reduce((s, t) => s + t.amount, 0))}
            accent="text-chart-4" bg="bg-chart-4/10" />
          <SummaryCard icon={CheckCheck} label="Confirmed"
            value={String(txns.filter((t) => t.status === "confirmed").length)}
            accent="text-yes"     bg="bg-yes/10" />
          <SummaryCard icon={XCircle}    label="Failed"
            value={String(txns.filter((t) => t.status === "failed").length)}
            accent="text-no"      bg="bg-no/10" />
        </div>
      )}

      {/* ── Table ── */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">

        {/* Table header bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <p className="text-sm font-semibold text-foreground">Transaction History</p>
          {total > 0 && (
            <span className="rounded-full bg-brand/15 text-brand text-xs font-semibold px-3 py-1">
              {total} transactions
            </span>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : txns.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary">
              <ArrowUpDown className="h-7 w-7 text-muted-foreground/40" />
            </div>
            <div>
              <p className="text-base font-semibold text-foreground">No transactions yet</p>
              <p className="text-sm text-muted-foreground mt-1">Your transaction history will appear here</p>
            </div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-secondary/30">
                    <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground w-12">#</th>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Type</th>
                    <th className="px-6 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Amount</th>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Description</th>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {txns.map((tx, idx) => (
                    <tr key={tx._id} className="hover:bg-secondary/20 transition-colors">
                      <td className="px-6 py-4 text-sm text-muted-foreground font-mono">
                        {(page - 1) * 10 + idx + 1}
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold capitalize",
                          TYPE_STYLE[tx.type] ?? "bg-secondary text-muted-foreground"
                        )}>
                          {tx.type.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="text-sm font-semibold font-mono text-foreground">
                          {fmtAmt(tx.amount)}
                        </span>
                        {tx.currency && (
                          <span className="ml-1.5 text-xs text-muted-foreground">{tx.currency}</span>
                        )}
                      </td>
                      <td className="px-6 py-4 max-w-xs">
                        <p className="truncate text-sm text-muted-foreground">
                          {tx.description || "—"}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold capitalize",
                          STATUS_STYLE[tx.status] ?? "bg-secondary text-muted-foreground"
                        )}>
                          {tx.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground whitespace-nowrap">
                        {fmt(tx.createdAt)}
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
