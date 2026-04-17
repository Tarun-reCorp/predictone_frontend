"use client";

import { useEffect, useState, useCallback } from "react";
import {
  HandCoins, Search, Loader2, DollarSign, ArrowUpCircle, ArrowDownCircle, X,
  ChevronLeft, ChevronRight, RefreshCw, Filter,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface Merchant {
  _id: string;
  name: string;
  email: string;
  status: "active" | "blocked";
  walletBalance: number;
}

interface TopupRecord {
  _id: string;
  merchantId: { _id: string; name: string; email: string } | null;
  performedBy: { _id: string; name: string; email: string } | null;
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

export default function TopupPage() {
  const { token } = useAuth();
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState("");

  // Adjustment state
  const [selectedId, setSelectedId]     = useState<string | null>(null);
  const [adjustType, setAdjustType]     = useState<"admin_credit" | "admin_debit">("admin_credit");
  const [amount, setAmount]             = useState("");
  const [description, setDescription]   = useState("");
  const [submitting, setSubmitting]     = useState(false);
  const [error, setError]               = useState("");
  const [success, setSuccess]           = useState("");

  // History state
  const [history, setHistory]           = useState<TopupRecord[]>([]);
  const [histLoading, setHistLoading]   = useState(true);
  const [histPage, setHistPage]         = useState(1);
  const [histTotalPages, setHistTotalPages] = useState(1);
  const [histTotal, setHistTotal]       = useState(0);
  const [histFilter, setHistFilter]     = useState("");
  const [histMerchant, setHistMerchant] = useState("");

  const fetchMerchants = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/admin/merchants?limit=100`, { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      setMerchants(json.data ?? []);
    } catch {} finally { setLoading(false); }
  }, [token]);

  const fetchHistory = useCallback(async () => {
    if (!token) return;
    setHistLoading(true);
    try {
      const params = new URLSearchParams({ page: String(histPage), limit: "15" });
      if (histFilter) params.set("type", histFilter);
      if (histMerchant) params.set("merchantId", histMerchant);

      const res = await fetch(`${API}/api/admin/topup-history?${params}`, { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      setHistory(json.data ?? []);
      setHistTotal(json.meta?.total ?? 0);
      setHistTotalPages(json.meta?.totalPages ?? 1);
    } catch {} finally { setHistLoading(false); }
  }, [token, histPage, histFilter, histMerchant]);

  useEffect(() => { fetchMerchants(); }, [fetchMerchants]);
  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const handleSubmit = async () => {
    if (!selectedId || !amount || parseFloat(amount) <= 0) {
      setError("Select a merchant and enter a valid amount");
      return;
    }
    setSubmitting(true); setError(""); setSuccess("");
    try {
      const res = await fetch(`${API}/api/admin/merchants/${selectedId}/wallet/adjust`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount: parseFloat(amount), type: adjustType, description }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      const merchant = merchants.find(m => m._id === selectedId);
      setSuccess(`${adjustType === "admin_credit" ? "Credited" : "Debited"} $${parseFloat(amount).toFixed(2)} ${merchant ? `to ${merchant.name}` : ""}`);
      setAmount(""); setDescription("");
      fetchMerchants();
      fetchHistory();
      setTimeout(() => setSuccess(""), 4000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally { setSubmitting(false); }
  };

  const filtered = merchants.filter(m =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    m.email.toLowerCase().includes(search.toLowerCase())
  );

  const selected = merchants.find(m => m._id === selectedId);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Topup / Wallet Adjustment</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Credit or debit merchant wallets.</p>
      </div>

      {success && (
        <div className="rounded-lg bg-yes/10 border border-yes/20 px-4 py-2.5 text-sm text-yes flex items-center gap-2">
          <ArrowUpCircle className="h-4 w-4" /> {success}
        </div>
      )}
      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-2.5 text-sm text-destructive flex items-center gap-2">
          <X className="h-4 w-4" /> {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Merchant select */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground">Select Merchant</h2>
          </div>
          <div className="p-4">
            <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary px-3 py-2 mb-3">
              <Search className="h-4 w-4 text-muted-foreground shrink-0" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..."
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none" />
            </div>
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : (
              <div className="max-h-[280px] overflow-y-auto space-y-1">
                {filtered.map(m => (
                  <button key={m._id} onClick={() => { setSelectedId(m._id); setError(""); }}
                    className={cn("w-full flex items-center justify-between rounded-lg px-3 py-2.5 text-left transition-colors",
                      selectedId === m._id ? "bg-brand/15 border border-brand/30" : "hover:bg-secondary border border-transparent")}>
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand/20 text-brand text-[10px] font-bold shrink-0">
                        {m.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{m.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                      </div>
                    </div>
                    <span className="text-sm font-mono font-bold text-yes shrink-0">${m.walletBalance.toFixed(2)}</span>
                  </button>
                ))}
                {filtered.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No merchants found</p>}
              </div>
            )}
          </div>
        </div>

        {/* Adjustment form */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground">
              {selected ? `Adjust: ${selected.name}` : "Adjustment Details"}
            </h2>
          </div>
          <div className="p-5 space-y-4">
            {selected && (
              <div className="rounded-lg bg-secondary/50 px-4 py-3 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Current Balance</span>
                <span className="text-lg font-bold font-mono text-yes">${selected.walletBalance.toFixed(2)}</span>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setAdjustType("admin_credit")}
                className={cn("flex items-center justify-center gap-2 rounded-lg py-3 text-sm font-semibold transition-colors",
                  adjustType === "admin_credit" ? "bg-yes text-white" : "bg-secondary text-muted-foreground hover:text-foreground")}>
                <ArrowUpCircle className="h-4 w-4" /> Credit
              </button>
              <button onClick={() => setAdjustType("admin_debit")}
                className={cn("flex items-center justify-center gap-2 rounded-lg py-3 text-sm font-semibold transition-colors",
                  adjustType === "admin_debit" ? "bg-no text-white" : "bg-secondary text-muted-foreground hover:text-foreground")}>
                <ArrowDownCircle className="h-4 w-4" /> Debit
              </button>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">Amount (USDC)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                <input type="number" min="0.01" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00"
                  className="w-full rounded-lg border border-border bg-secondary pl-7 pr-3 py-2.5 text-sm text-foreground outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20" />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">Description (optional)</label>
              <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Reason for adjustment..."
                className="w-full rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm text-foreground outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20" />
            </div>
            <button onClick={handleSubmit}
              disabled={selectedId === null || submitting || amount === "" || Number(amount) <= 0}
              className={cn("w-full flex items-center justify-center gap-2 rounded-lg py-3 text-sm font-semibold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
                adjustType === "admin_credit" ? "bg-yes hover:bg-yes/90" : "bg-no hover:bg-no/90")}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <DollarSign className="h-4 w-4" />}
              {submitting ? "Processing..." : `${adjustType === "admin_credit" ? "Credit" : "Debit"} ${amount && Number(amount) > 0 ? `$${Number(amount).toFixed(2)}` : ""}`}
            </button>
          </div>
        </div>
      </div>

      {/* ── Topup History ── */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <HandCoins className="h-4 w-4 text-brand" />
            <h2 className="text-sm font-semibold text-foreground">Topup History</h2>
            {histTotal > 0 && (
              <span className="rounded-full bg-brand/20 text-brand text-xs font-bold px-2 py-0.5">{histTotal}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Type filter */}
            <select
              value={histFilter}
              onChange={e => { setHistFilter(e.target.value); setHistPage(1); }}
              className="rounded-lg border border-border bg-secondary px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-brand/50"
            >
              {FILTER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>

            {/* Merchant filter */}
            <select
              value={histMerchant}
              onChange={e => { setHistMerchant(e.target.value); setHistPage(1); }}
              className="rounded-lg border border-border bg-secondary px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-brand/50 max-w-[160px]"
            >
              <option value="">All Merchants</option>
              {merchants.map(m => <option key={m._id} value={m._id}>{m.name}</option>)}
            </select>

            <button onClick={fetchHistory} className="flex h-8 w-8 items-center justify-center rounded-lg border border-border hover:bg-secondary transition-colors">
              <RefreshCw className={cn("h-3.5 w-3.5 text-muted-foreground", histLoading && "animate-spin")} />
            </button>
          </div>
        </div>

        {histLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : history.length === 0 ? (
          <div className="flex flex-col items-center py-12 gap-2 text-center">
            <HandCoins className="h-8 w-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No topup records found</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-secondary/30">
                    <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Merchant</th>
                    <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Type</th>
                    <th className="px-4 py-3 text-right font-semibold text-muted-foreground">Amount</th>
                    <th className="px-4 py-3 text-right font-semibold text-muted-foreground">Balance After</th>
                    <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Description</th>
                    <th className="px-4 py-3 text-left font-semibold text-muted-foreground">By</th>
                    <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {history.map(rec => {
                    const style = TYPE_STYLE[rec.type] ?? { label: rec.type, color: "text-foreground", bg: "bg-secondary" };
                    const isCredit = rec.type === "credit";
                    return (
                      <tr key={rec._id} className="hover:bg-secondary/20 transition-colors">
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium text-foreground">{rec.merchantId?.name ?? "—"}</p>
                          <p className="text-[10px] text-muted-foreground">{rec.merchantId?.email ?? ""}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold", style.color, style.bg)}>
                            {style.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={cn("font-mono font-semibold text-sm", isCredit ? "text-yes" : "text-no")}>
                            {isCredit ? "+" : "-"}${rec.amount.toFixed(2)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-sm text-foreground">${rec.balanceAfter.toFixed(2)}</td>
                        <td className="px-4 py-3 max-w-[200px]">
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

            {/* Pagination */}
            {histTotalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-border">
                <span className="text-xs text-muted-foreground">
                  Page <b>{histPage}</b> of <b>{histTotalPages}</b> ({histTotal} records)
                </span>
                <div className="flex items-center gap-1">
                  <button onClick={() => setHistPage(p => p - 1)} disabled={histPage <= 1}
                    className="flex items-center gap-1 rounded border border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-40 transition-colors">
                    <ChevronLeft className="h-3.5 w-3.5" /> Prev
                  </button>
                  <button onClick={() => setHistPage(p => p + 1)} disabled={histPage >= histTotalPages}
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
