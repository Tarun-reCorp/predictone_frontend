"use client";

import { useEffect, useState, useCallback } from "react";
import {
  HandCoins, Loader2, ChevronLeft, ChevronRight, RefreshCw,
} from "lucide-react";
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
  debit:  { label: "Debit",  color: "text-no",  bg: "bg-no/15" },
};

const FILTER_OPTIONS = [
  { value: "",       label: "All Types" },
  { value: "credit", label: "Credit" },
  { value: "debit",  label: "Debit" },
];

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function MerchantTopupPage() {
  const { token } = useAuth();

  const [history, setHistory]           = useState<TopupRecord[]>([]);
  const [loading, setLoading]           = useState(true);
  const [page, setPage]                 = useState(1);
  const [totalPages, setTotalPages]     = useState(1);
  const [total, setTotal]               = useState(0);
  const [filter, setFilter]             = useState("");

  const fetchHistory = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "15" });
      if (filter) params.set("type", filter);

      const res = await fetch(`${API}/api/merchant/topup-history?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      setHistory(json.data ?? []);
      setTotal(json.meta?.total ?? 0);
      setTotalPages(json.meta?.totalPages ?? 1);
    } catch {} finally { setLoading(false); }
  }, [token, page, filter]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Topup History</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          View all credits, debits, fund approvals and refunds on your wallet.
        </p>
      </div>

      {/* History Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <HandCoins className="h-4 w-4 text-brand" />
            <h2 className="text-sm font-semibold text-foreground">History</h2>
            {total > 0 && (
              <span className="rounded-full bg-brand/20 text-brand text-xs font-bold px-2 py-0.5">{total}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <select
              value={filter}
              onChange={e => { setFilter(e.target.value); setPage(1); }}
              className="rounded-lg border border-border bg-secondary px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-brand/50"
            >
              {FILTER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <button onClick={fetchHistory}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border hover:bg-secondary transition-colors">
              <RefreshCw className={cn("h-3.5 w-3.5 text-muted-foreground", loading && "animate-spin")} />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-14"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : history.length === 0 ? (
          <div className="flex flex-col items-center py-14 gap-2 text-center">
            <HandCoins className="h-9 w-9 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No topup records yet</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-secondary/30">
                    <th className="px-5 py-3 text-left font-semibold text-muted-foreground">Type</th>
                    <th className="px-5 py-3 text-right font-semibold text-muted-foreground">Amount</th>
                    <th className="px-5 py-3 text-right font-semibold text-muted-foreground">Balance After</th>
                    <th className="px-5 py-3 text-left font-semibold text-muted-foreground">Description</th>
                    <th className="px-5 py-3 text-left font-semibold text-muted-foreground">By</th>
                    <th className="px-5 py-3 text-left font-semibold text-muted-foreground">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {history.map(rec => {
                    const style = TYPE_STYLE[rec.type] ?? { label: rec.type, color: "text-foreground", bg: "bg-secondary" };
                    const isCredit = rec.type === "credit";
                    return (
                      <tr key={rec._id} className="hover:bg-secondary/20 transition-colors">
                        <td className="px-5 py-3.5">
                          <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold", style.color, style.bg)}>
                            {style.label}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <span className={cn("font-mono font-bold text-sm", isCredit ? "text-yes" : "text-no")}>
                            {isCredit ? "+" : "-"}${rec.amount.toFixed(2)}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right font-mono text-sm text-foreground">${rec.balanceAfter.toFixed(2)}</td>
                        <td className="px-5 py-3.5 max-w-[220px]">
                          <p className="text-sm text-muted-foreground truncate">{rec.description || "—"}</p>
                        </td>
                        <td className="px-5 py-3.5 text-sm text-muted-foreground">{rec.performedBy?.name ?? "—"}</td>
                        <td className="px-5 py-3.5 text-sm text-muted-foreground whitespace-nowrap">{fmtDate(rec.createdAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-border">
                <span className="text-xs text-muted-foreground">
                  Page <b>{page}</b> of <b>{totalPages}</b> ({total} records)
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
            )}
          </>
        )}
      </div>
    </div>
  );
}
