"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ArrowUpCircle, Clock, CheckCircle2, XCircle,
  ChevronLeft, ChevronRight, Loader2, Filter,
  CalendarClock, ListChecks, QrCode, CreditCard, Bitcoin, FileText,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";
import { TABLE } from "@/lib/table-styles";
import { SummaryCards, type SummaryCardItem } from "@/components/summary-cards";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface FundRequest {
  _id: string;
  userId: { _id: string; name: string; email: string; walletBalance: number };
  amount: number;
  currency: string;
  orderId?: string;
  paymentMethod?: "upi" | "card" | "crypto" | "manual";
  paymentReference?: string;
  merchantNote?: string;
  status: "pending" | "approved" | "rejected";
  adminNote?: string;
  reviewedBy?: { name: string };
  reviewedAt?: string;
  createdAt: string;
}

interface Summary {
  approved: number;
  pending: number;
  rejected: number;
  today: number;
  total: number;
}

const STATUS_STYLE = {
  pending:  { label: "Pending",  color: "text-chart-4", bg: "bg-chart-4/15", icon: Clock        },
  approved: { label: "Approved", color: "text-yes",     bg: "bg-yes/15",     icon: CheckCircle2 },
  rejected: { label: "Rejected", color: "text-no",      bg: "bg-no/15",      icon: XCircle      },
};

const PM_STYLE = {
  upi:    { label: "UPI",    icon: QrCode,     color: "text-chart-4",          bg: "bg-chart-4/15" },
  card:   { label: "Card",   icon: CreditCard, color: "text-brand",            bg: "bg-brand/15"   },
  crypto: { label: "Crypto", icon: Bitcoin,    color: "text-yes",              bg: "bg-yes/15"     },
  manual: { label: "Manual", icon: FileText,   color: "text-muted-foreground", bg: "bg-secondary"  },
};

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function AdminFundRequestsPage() {
  const { token } = useAuth();
  const [requests, setRequests] = useState<FundRequest[]>([]);
  const [summary, setSummary]   = useState<Summary>({ approved: 0, pending: 0, rejected: 0, today: 0, total: 0 });
  const [loading, setLoading]   = useState(true);
  const [page, setPage]         = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filterStatus, setFilterStatus] = useState("");

  // Review modal
  const [reviewing, setReviewing]     = useState<FundRequest | null>(null);
  const [action, setAction]           = useState<"approved" | "rejected">("approved");
  const [adminNote, setAdminNote]     = useState("");
  const [submitting, setSubmitting]   = useState(false);
  const [reviewError, setReviewError] = useState("");

  const load = useCallback(() => {
    if (!token) return;
    setLoading(true);
    const q = new URLSearchParams({ page: String(page), limit: "15" });
    if (filterStatus) q.set("status", filterStatus);

    Promise.all([
      fetch(`${API}/api/admin/fund-requests?${q}`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch(`${API}/api/admin/fund-requests/summary`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
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

  const handleReview = async () => {
    if (!reviewing) return;
    setSubmitting(true); setReviewError("");
    try {
      const res = await fetch(`${API}/api/admin/fund-requests/${reviewing._id}/review`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action, adminNote }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Failed");
      setReviewing(null); setAdminNote(""); load();
    } catch (err: unknown) {
      setReviewError(err instanceof Error ? err.message : "Failed");
    } finally { setSubmitting(false); }
  };

  const cards: SummaryCardItem[] = [
    { label: "Total",    value: summary.total,    icon: ListChecks,    tone: "default" },
    { label: "Approved", value: summary.approved, icon: CheckCircle2,  tone: "yes" },
    { label: "Pending",  value: summary.pending,  icon: Clock,         tone: "warn" },
    { label: "Today",    value: summary.today,    icon: CalendarClock, tone: "brand" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Fund Requests</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Review merchant top-up requests and credit wallets.</p>
      </div>

      {/* Summary */}
      <SummaryCards items={cards} />

      {/* Review modal */}
      {reviewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl">
            <div className="px-6 py-4 border-b border-border">
              <h2 className="text-base font-bold text-foreground">Review Fund Request</h2>
            </div>
            <div className="p-6 flex flex-col gap-4">
              <div className="rounded-lg border border-border bg-secondary/50 divide-y divide-border/50">
                {[
                  { label: "Merchant",  value: reviewing.userId?.name },
                  { label: "Amount",    value: `$${reviewing.amount.toFixed(2)} ${reviewing.currency}` },
                  { label: "Order ID",  value: reviewing.orderId || "—" },
                  { label: "Reference", value: reviewing.paymentReference || "—" },
                  { label: "Note",      value: reviewing.merchantNote || "—" },
                ].map(row => (
                  <div key={row.label} className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-xs text-muted-foreground">{row.label}</span>
                    <span className="text-xs font-medium text-foreground font-mono">{row.value}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-xs text-muted-foreground">Method</span>
                  {(() => {
                    const pm = PM_STYLE[reviewing.paymentMethod ?? "manual"];
                    return (
                      <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold", pm.color, pm.bg)}>
                        <pm.icon className="h-3 w-3" /> {pm.label}
                      </span>
                    );
                  })()}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setAction("approved")}
                  className={cn("flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-colors",
                    action === "approved" ? "bg-yes text-white" : "bg-secondary text-muted-foreground hover:text-foreground")}
                >
                  <CheckCircle2 className="h-4 w-4" /> Approve
                </button>
                <button
                  onClick={() => setAction("rejected")}
                  className={cn("flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-colors",
                    action === "rejected" ? "bg-no text-white" : "bg-secondary text-muted-foreground hover:text-foreground")}
                >
                  <XCircle className="h-4 w-4" /> Reject
                </button>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground">Admin Note (optional)</label>
                <textarea
                  value={adminNote} onChange={e => setAdminNote(e.target.value)} rows={2}
                  placeholder="Reason for approval/rejection..."
                  className="w-full rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm text-foreground outline-none focus:border-brand/50 resize-none"
                />
              </div>

              {reviewError && <div className="text-sm text-destructive">{reviewError}</div>}

              <div className="flex gap-3">
                <button onClick={() => { setReviewing(null); setAdminNote(""); setReviewError(""); }}
                  className="flex-1 rounded-lg border border-border bg-secondary py-2.5 text-sm font-medium text-foreground hover:bg-secondary/80 transition-colors">
                  Cancel
                </button>
                <button onClick={handleReview} disabled={submitting}
                  className={cn("flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold text-white transition-colors disabled:opacity-60",
                    action === "approved" ? "bg-yes hover:bg-yes/90" : "bg-no hover:bg-no/90")}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {submitting ? "Processing…" : action === "approved" ? "Approve & Credit Wallet" : "Reject Request"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className={TABLE.wrapper}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <p className="text-sm font-semibold text-foreground">Requests</p>
          <div className="flex items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            <select
              value={filterStatus}
              onChange={e => { setFilterStatus(e.target.value); setPage(1); }}
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
            <p className="text-sm text-muted-foreground">No fund requests</p>
          </div>
        ) : (
          <>
            <div className={TABLE.scroll}>
              <table className={TABLE.table}>
                <thead>
                  <tr className={TABLE.thead}>
                    <th className={TABLE.th}>Merchant</th>
                    <th className={TABLE.thRight}>Amount</th>
                    <th className={TABLE.th}>Method</th>
                    <th className={TABLE.th}>Order ID</th>
                    <th className={TABLE.th}>UTR / Ref</th>
                    <th className={TABLE.th}>Status</th>
                    <th className={TABLE.thRight}>Balance</th>
                    <th className={TABLE.th}>Submitted</th>
                    <th className={TABLE.th}>Action</th>
                  </tr>
                </thead>
                <tbody className={TABLE.tbody}>
                  {requests.map(req => {
                    const s = STATUS_STYLE[req.status];
                    return (
                      <tr key={req._id} className={TABLE.row}>
                        <td className={TABLE.td}>
                          <p className="font-medium text-foreground">{req.userId?.name}</p>
                          <p className="text-xs text-muted-foreground">{req.userId?.email}</p>
                        </td>
                        <td className={TABLE.tdRight}>
                          <span className="font-mono font-bold">${req.amount.toFixed(2)}</span>
                          <span className="ml-1 text-xs text-muted-foreground">{req.currency}</span>
                        </td>
                        <td className={TABLE.td}>
                          {(() => {
                            const pm = PM_STYLE[req.paymentMethod ?? "manual"];
                            return (
                              <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", pm.color, pm.bg)}>
                                <pm.icon className="h-3 w-3" /> {pm.label}
                              </span>
                            );
                          })()}
                        </td>
                        <td className={cn(TABLE.tdMuted, "max-w-[140px]")}>
                          <p className="truncate font-mono text-xs">{req.orderId || "—"}</p>
                        </td>
                        <td className={cn(TABLE.tdMuted, "max-w-[160px]")}>
                          <p className="truncate">{req.paymentReference || "—"}</p>
                        </td>
                        <td className={TABLE.td}>
                          <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", s.color, s.bg)}>
                            <s.icon className="h-3 w-3" /> {s.label}
                          </span>
                          {req.adminNote && <p className="text-xs text-muted-foreground mt-1 max-w-[140px] truncate">{req.adminNote}</p>}
                        </td>
                        <td className={cn(TABLE.tdRight, "font-mono text-yes")}>${(req.userId?.walletBalance ?? 0).toFixed(2)}</td>
                        <td className={cn(TABLE.tdMuted, "whitespace-nowrap")}>{fmt(req.createdAt)}</td>
                        <td className={TABLE.td}>
                          {req.status === "pending" ? (
                            <button onClick={() => { setReviewing(req); setAction("approved"); setAdminNote(""); setReviewError(""); }}
                              className="flex items-center gap-1.5 rounded-md bg-brand/10 text-brand hover:bg-brand/20 px-3 py-1.5 text-xs font-semibold transition-colors">
                              Review
                            </button>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              {req.reviewedBy?.name && `by ${req.reviewedBy.name}`}
                            </span>
                          )}
                        </td>
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
                    className="flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-muted-foreground hover:text-foreground disabled:opacity-40">
                    <ChevronLeft className="h-3.5 w-3.5" /> Prev
                  </button>
                  <button onClick={() => setPage(p => p + 1)} disabled={page >= totalPages}
                    className="flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-muted-foreground hover:text-foreground disabled:opacity-40">
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
