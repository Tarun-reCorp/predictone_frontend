"use client";

import { useState, useEffect } from "react";
import {
  Wallet, TrendingUp, Receipt, Clock, CheckCheck, XCircle,
  ArrowUpCircle, ArrowDownCircle, ChevronLeft, ChevronRight, Loader2,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface WalletInfo {
  balance: number;
  totalCommissionPaid: number;
  pendingCount: number;
}

interface WalletTx {
  _id: string;
  type: string;
  amount: number;
  balanceAfter: number;
  description?: string;
  createdAt: string;
}

const TX_TYPE_STYLE: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  fund_credit:     { label: "Fund Credit",     color: "text-yes",        bg: "bg-yes/10",        icon: ArrowUpCircle   },
  order_deduction: { label: "Order Deduction", color: "text-no",         bg: "bg-no/10",         icon: ArrowDownCircle },
  commission:      { label: "Commission",      color: "text-chart-4",    bg: "bg-chart-4/10",    icon: Receipt         },
  admin_credit:    { label: "Admin Credit",    color: "text-yes",        bg: "bg-yes/10",        icon: ArrowUpCircle   },
  admin_debit:     { label: "Admin Debit",     color: "text-no",         bg: "bg-no/10",         icon: ArrowDownCircle },
  refund:          { label: "Refund",          color: "text-brand",      bg: "bg-brand/10",      icon: ArrowUpCircle   },
};

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function MerchantWalletPage() {
  const { token } = useAuth();
  const [info, setInfo]         = useState<WalletInfo | null>(null);
  const [txns, setTxns]         = useState<WalletTx[]>([]);
  const [loading, setLoading]   = useState(true);
  const [txLoading, setTxLoading] = useState(true);
  const [page, setPage]         = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    if (!token) return;
    fetch(`${API}/api/merchant/wallet`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => setInfo(d.data)).catch(() => {}).finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    if (!token) return;
    setTxLoading(true);
    fetch(`${API}/api/merchant/wallet/ledger?page=${page}&limit=15`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        setTxns(d.data ?? []);
        setTotalPages(d.meta?.totalPages ?? 1);
      })
      .catch(() => {})
      .finally(() => setTxLoading(false));
  }, [token, page]);

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Wallet</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Your balance and transaction history</p>
        </div>
        <Link
          href="/merchant/fund-requests"
          className="flex items-center gap-2 rounded-lg bg-brand hover:bg-brand/90 text-primary-foreground font-semibold px-4 py-2 text-sm transition-colors"
        >
          <ArrowUpCircle className="h-4 w-4" />
          Add Funds
        </Link>
      </div>

      {/* Balance cards */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="h-28 rounded-xl bg-secondary animate-pulse" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-xl border border-border bg-card p-5 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium uppercase tracking-wider">
              <Wallet className="h-3.5 w-3.5" /> Current Balance
            </div>
            <p className="text-3xl font-bold font-mono text-yes">${(info?.balance ?? 0).toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">Available USDC</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-5 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium uppercase tracking-wider">
              <Receipt className="h-3.5 w-3.5" /> Commission Paid
            </div>
            <p className="text-3xl font-bold font-mono text-chart-4">${(info?.totalCommissionPaid ?? 0).toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">Total deducted</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-5 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium uppercase tracking-wider">
              <Clock className="h-3.5 w-3.5" /> Pending Requests
            </div>
            <p className="text-3xl font-bold font-mono text-brand">{info?.pendingCount ?? 0}</p>
            <Link href="/merchant/fund-requests" className="text-xs text-brand hover:underline">View all</Link>
          </div>
        </div>
      )}

      {/* Ledger */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <p className="text-sm font-semibold text-foreground">Transaction Ledger</p>
        </div>
        {txLoading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : txns.length === 0 ? (
          <div className="flex flex-col items-center py-16 gap-2 text-center">
            <Receipt className="h-9 w-9 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No transactions yet</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-secondary/30">
                    {["Type", "Amount", "Balance After", "Description", "Date"].map(h => (
                      <th key={h} className={cn("px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground", h === "Amount" || h === "Balance After" ? "text-right" : "")}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {txns.map(tx => {
                    const meta = TX_TYPE_STYLE[tx.type] ?? { label: tx.type, color: "text-foreground", bg: "bg-secondary", icon: Receipt };
                    const isCredit = tx.amount > 0;
                    return (
                      <tr key={tx._id} className="hover:bg-secondary/20 transition-colors">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <div className={cn("flex h-7 w-7 items-center justify-center rounded-lg shrink-0", meta.bg)}>
                              <meta.icon className={cn("h-3.5 w-3.5", meta.color)} />
                            </div>
                            <span className={cn("text-sm font-medium", meta.color)}>{meta.label}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <span className={cn("text-sm font-bold font-mono", isCredit ? "text-yes" : "text-no")}>
                            {isCredit ? "+" : ""}${Math.abs(tx.amount).toFixed(2)}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <span className="text-sm font-mono text-foreground">${tx.balanceAfter.toFixed(2)}</span>
                        </td>
                        <td className="px-5 py-4 max-w-xs">
                          <p className="text-sm text-muted-foreground truncate">{tx.description || "—"}</p>
                        </td>
                        <td className="px-5 py-4 text-sm text-muted-foreground whitespace-nowrap">{fmt(tx.createdAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {/* Pagination */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-secondary/10">
              <span className="text-sm text-muted-foreground">Page <b>{page}</b> of <b>{totalPages}</b></span>
              <div className="flex gap-2">
                <button onClick={() => setPage(p => p - 1)} disabled={page <= 1}
                  className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-40 transition-colors">
                  <ChevronLeft className="h-4 w-4" /> Prev
                </button>
                <button onClick={() => setPage(p => p + 1)} disabled={page >= totalPages}
                  className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-40 transition-colors">
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
