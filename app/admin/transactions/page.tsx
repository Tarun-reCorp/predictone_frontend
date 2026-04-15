"use client";

import { useState, useEffect } from "react";
import {
  ArrowUpDown, ChevronLeft, ChevronRight,
  Receipt, DollarSign, CheckCheck, XCircle, Loader2,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface AdminTransaction {
  _id: string;
  merchantId?: { name?: string } | string;
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

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}
function fmtAmt(n: number) { return `$${n.toFixed(2)}`; }

export default function AdminTransactionsPage() {
  const { token } = useAuth();

  const [txns, setTxns]         = useState<AdminTransaction[]>([]);
  const [loading, setLoading]   = useState(true);
  const [page, setPage]         = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal]       = useState(0);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    fetch(`${BACKEND}/api/admin/transactions?page=${page}&limit=10`, {
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
    <div className="flex flex-col gap-4">
      {/* Page heading */}
      <div className="flex items-center gap-2">
        <ArrowUpDown className="h-5 w-5 text-brand" />
        <h1 className="text-xl font-bold text-foreground">All Transactions</h1>
        {total > 0 && (
          <span className="rounded-full bg-brand/20 text-brand text-xs font-bold px-2 py-0.5 ml-1">
            {total}
          </span>
        )}
      </div>

      {/* Summary cards */}
      {!loading && txns.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : txns.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
            <ArrowUpDown className="h-9 w-9 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No transactions found</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-secondary/20">
                    {["#", "Merchant", "Type", "Amount", "Description", "Status", "Date"].map((h) => (
                      <th key={h} className={cn(
                        "px-4 py-3 font-medium text-muted-foreground",
                        h === "Amount" ? "text-right" : "text-left"
                      )}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {txns.map((tx, idx) => {
                    const merchant = typeof tx.merchantId === "object" ? tx.merchantId : null;
                    return (
                      <tr key={tx._id} className="hover:bg-secondary/10 transition-colors">
                        <td className="px-4 py-3 text-muted-foreground font-mono">{(page - 1) * 10 + idx + 1}</td>
                        <td className="px-4 py-3 text-foreground">
                          {merchant?.name ?? (typeof tx.merchantId === "string" ? tx.merchantId.slice(0, 8) + "…" : "—")}
                        </td>
                        <td className="px-4 py-3">
                          <span className="capitalize text-foreground font-medium">
                            {tx.type.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-foreground">
                          {fmtAmt(tx.amount)}{" "}
                          <span className="text-muted-foreground">{tx.currency}</span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground max-w-[200px]">
                          <p className="truncate">{tx.description || "—"}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn(
                            "rounded-full px-2 py-0.5 font-semibold text-[10px] capitalize",
                            STATUS_STYLE[tx.status] ?? "bg-secondary text-muted-foreground"
                          )}>{tx.status}</span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{fmt(tx.createdAt)}</td>
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

function SummaryCard({ icon: Icon, label, value, accent, bg }: {
  icon: React.ElementType; label: string; value: string; accent: string; bg: string;
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
        <button
          onClick={() => onChange(page - 1)} disabled={page <= 1}
          className="flex items-center gap-1 rounded border border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-40 transition-colors"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Prev
        </button>
        <button
          onClick={() => onChange(page + 1)} disabled={page >= totalPages}
          className="flex items-center gap-1 rounded border border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-40 transition-colors"
        >
          Next <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
