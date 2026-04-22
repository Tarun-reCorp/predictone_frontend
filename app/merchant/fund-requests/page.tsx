"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ArrowUpCircle, Clock, CheckCircle2, XCircle,
  ChevronLeft, ChevronRight, Loader2, Plus, X,
  Filter, CalendarClock, ListChecks,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";
import { TABLE } from "@/lib/table-styles";
import { SummaryCards, type SummaryCardItem } from "@/components/summary-cards";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface FundRequest {
  _id: string;
  amount: number;
  currency: string;
  paymentReference?: string;
  merchantNote?: string;
  status: "pending" | "approved" | "rejected";
  adminNote?: string;
  createdAt: string;
  reviewedAt?: string;
}

interface Summary {
  approved: number;
  pending: number;
  rejected: number;
  today: number;
  total: number;
}

const STATUS_STYLE = {
  pending:  { label: "Pending",  color: "text-chart-4", bg: "bg-chart-4/15", icon: Clock },
  approved: { label: "Approved", color: "text-yes",     bg: "bg-yes/15",     icon: CheckCircle2 },
  rejected: { label: "Rejected", color: "text-no",      bg: "bg-no/15",      icon: XCircle },
};

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function FundRequestsPage() {
  const { token } = useAuth();
  const [requests, setRequests] = useState<FundRequest[]>([]);
  const [summary, setSummary]   = useState<Summary>({ approved: 0, pending: 0, rejected: 0, today: 0, total: 0 });
  const [loading, setLoading]   = useState(true);
  const [page, setPage]         = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filterStatus, setFilterStatus] = useState("");

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [amount, setAmount]     = useState("");
  const [ref, setRef]           = useState("");
  const [note, setNote]         = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError]   = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  const load = useCallback(() => {
    if (!token) return;
    setLoading(true);
    const q = new URLSearchParams({ page: String(page), limit: "15" });
    if (filterStatus) q.set("status", filterStatus);

    Promise.all([
      fetch(`${API}/api/merchant/fund-requests?${q}`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch(`${API}/api/merchant/fund-requests/summary`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
    ])
      .then(([list, sum]) => {
        setRequests(list.data ?? []);
        setTotalPages(list.meta?.totalPages ?? 1);
        if (sum?.data) setSummary(sum.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token, page, filterStatus]);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(""); setFormSuccess("");
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { setFormError("Please enter a valid amount"); return; }
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/api/merchant/fund-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount: amt, paymentReference: ref, merchantNote: note }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Failed");
      setFormSuccess("Fund request submitted! Admin will review it.");
      setAmount(""); setRef(""); setNote("");
      setTimeout(() => { setShowForm(false); setFormSuccess(""); load(); }, 1500);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Failed to submit");
    } finally { setSubmitting(false); }
  };

  const cards: SummaryCardItem[] = [
    { label: "Total",     value: summary.total,    icon: ListChecks,    tone: "default" },
    { label: "Approved",  value: summary.approved, icon: CheckCircle2,  tone: "yes" },
    { label: "Pending",   value: summary.pending,  icon: Clock,         tone: "warn" },
    { label: "Today",     value: summary.today,    icon: CalendarClock, tone: "brand" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Fund Requests</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Submit UTR / transaction references after paying to top-up your wallet.
          </p>
        </div>
        <button
          onClick={() => { setShowForm(true); setFormError(""); setFormSuccess(""); }}
          className="flex items-center gap-2 rounded-lg bg-brand hover:bg-brand/90 text-primary-foreground font-semibold px-4 py-2 text-sm transition-colors"
        >
          <Plus className="h-4 w-4" /> New Request
        </button>
      </div>

      {/* Summary cards */}
      <SummaryCards items={cards} />

      {/* New request modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <h2 className="text-base font-bold text-foreground">New Fund Request</h2>
              <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
              {formError && <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-2.5 text-sm text-destructive">{formError}</div>}
              {formSuccess && <div className="rounded-lg bg-yes/10 border border-yes/20 px-4 py-2.5 text-sm text-yes">{formSuccess}</div>}

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground">Amount *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                  <input
                    type="number" min="1" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} required
                    placeholder="Enter amount"
                    className="w-full rounded-lg border border-border bg-secondary pl-7 pr-3 py-2.5 text-sm text-foreground outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground">UTR / Payment Reference</label>
                <input
                  type="text" value={ref} onChange={e => setRef(e.target.value)}
                  placeholder="Transaction ID, receipt no., etc."
                  className="w-full rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm text-foreground outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground">Note (optional)</label>
                <textarea
                  value={note} onChange={e => setNote(e.target.value)} rows={3}
                  placeholder="Any additional payment details..."
                  className="w-full rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm text-foreground outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20 resize-none"
                />
              </div>

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 rounded-lg border border-border bg-secondary hover:bg-secondary/80 py-2.5 text-sm font-medium text-foreground transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={submitting}
                  className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-brand hover:bg-brand/90 disabled:opacity-60 text-primary-foreground font-semibold py-2.5 text-sm transition-colors">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUpCircle className="h-4 w-4" />}
                  {submitting ? "Submitting…" : "Submit Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Table */}
      <div className={TABLE.wrapper}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <p className="text-sm font-semibold text-foreground">Request History</p>
          <div className="flex items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            <select
              value={filterStatus}
              onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
              className="rounded-md border border-border bg-secondary text-xs text-foreground px-2.5 py-1.5 outline-none"
            >
              <option value="">All status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : requests.length === 0 ? (
          <div className="flex flex-col items-center py-16 gap-2 text-center">
            <ArrowUpCircle className="h-9 w-9 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No fund requests yet</p>
            <p className="text-xs text-muted-foreground/60">Click &quot;New Request&quot; to top up your wallet</p>
          </div>
        ) : (
          <>
            <div className={TABLE.scroll}>
              <table className={TABLE.table}>
                <thead>
                  <tr className={TABLE.thead}>
                    <th className={TABLE.thRight}>Amount</th>
                    <th className={TABLE.th}>UTR / Ref</th>
                    <th className={TABLE.th}>Note</th>
                    <th className={TABLE.th}>Status</th>
                    <th className={TABLE.th}>Admin Note</th>
                    <th className={TABLE.th}>Date</th>
                  </tr>
                </thead>
                <tbody className={TABLE.tbody}>
                  {requests.map(req => {
                    const s = STATUS_STYLE[req.status];
                    return (
                      <tr key={req._id} className={TABLE.row}>
                        <td className={TABLE.tdRight}>
                          <span className="font-mono font-bold text-foreground">${req.amount.toFixed(2)}</span>
                          <span className="ml-1 text-xs text-muted-foreground">{req.currency}</span>
                        </td>
                        <td className={cn(TABLE.tdMuted, "max-w-[160px]")}>
                          <p className="truncate">{req.paymentReference || "—"}</p>
                        </td>
                        <td className={cn(TABLE.tdMuted, "max-w-[180px]")}>
                          <p className="truncate">{req.merchantNote || "—"}</p>
                        </td>
                        <td className={TABLE.td}>
                          <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", s.color, s.bg)}>
                            <s.icon className="h-3 w-3" /> {s.label}
                          </span>
                        </td>
                        <td className={cn(TABLE.tdMuted, "max-w-[180px]")}>
                          <p className="truncate">{req.adminNote || "—"}</p>
                        </td>
                        <td className={cn(TABLE.tdMuted, "whitespace-nowrap")}>{fmt(req.createdAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className={TABLE.footer}>
                <span className="text-muted-foreground">Page <b>{page}</b> of <b>{totalPages}</b></span>
                <div className="flex gap-2">
                  <button onClick={() => setPage(p => p - 1)} disabled={page <= 1}
                    className="flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors">
                    <ChevronLeft className="h-3.5 w-3.5" /> Prev
                  </button>
                  <button onClick={() => setPage(p => p + 1)} disabled={page >= totalPages}
                    className="flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors">
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
