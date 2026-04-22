"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ArrowDownCircle, Clock, CheckCircle2, XCircle,
  ChevronLeft, ChevronRight, Loader2, Filter,
  Building2, QrCode, Bitcoin, X, RefreshCw,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";
import { TABLE } from "@/lib/table-styles";
import { SummaryCards, type SummaryCardItem } from "@/components/summary-cards";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

// ── Types ──────────────────────────────────────────────────────────────────────

type PaymentMethod = "bank" | "upi" | "crypto";

interface AccountDetails {
  bankName?: string;
  accountHolder?: string;
  accountNumber?: string;
  ifscCode?: string;
  upiId?: string;
  walletAddress?: string;
  network?: string;
}

interface WithdrawRequest {
  _id: string;
  userId: { _id: string; name: string; email: string; walletBalance: number };
  amount: number;
  currency: string;
  paymentMethod: PaymentMethod;
  accountDetails: AccountDetails;
  merchantNote?: string;
  status: "pending" | "approved" | "rejected";
  adminNote?: string;
  reviewedBy?: { name: string };
  reviewedAt?: string;
  createdAt: string;
}

interface Summary {
  pending: number;
  approved: number;
  rejected: number;
  today: number;
  total: number;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const STATUS_STYLE = {
  pending:  { label: "Pending",  color: "text-chart-4", bg: "bg-chart-4/15", icon: Clock        },
  approved: { label: "Approved", color: "text-yes",     bg: "bg-yes/15",     icon: CheckCircle2 },
  rejected: { label: "Rejected", color: "text-no",      bg: "bg-no/15",      icon: XCircle      },
};

const PM_STYLE: Record<PaymentMethod, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  bank:   { label: "Bank",   icon: Building2, color: "text-brand",   bg: "bg-brand/15"   },
  upi:    { label: "UPI",    icon: QrCode,    color: "text-chart-4", bg: "bg-chart-4/15" },
  crypto: { label: "Crypto", icon: Bitcoin,   color: "text-yes",     bg: "bg-yes/15"     },
};

const STATUS_FILTERS = [
  { label: "All",      key: "" },
  { label: "Pending",  key: "pending" },
  { label: "Approved", key: "approved" },
  { label: "Rejected", key: "rejected" },
];

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function AdminWithdrawRequestsPage() {
  const { token } = useAuth();

  const [requests, setRequests]   = useState<WithdrawRequest[]>([]);
  const [summary, setSummary]     = useState<Summary>({ pending: 0, approved: 0, rejected: 0, today: 0, total: 0 });
  const [loading, setLoading]     = useState(true);
  const [page, setPage]           = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filterStatus, setFilterStatus] = useState("");

  // Review modal
  const [reviewing, setReviewing]   = useState<WithdrawRequest | null>(null);
  const [action, setAction]         = useState<"approved" | "rejected">("approved");
  const [adminNote, setAdminNote]   = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState("");

  const load = useCallback(() => {
    if (!token) return;
    setLoading(true);
    const q = new URLSearchParams({ page: String(page), limit: "15" });
    if (filterStatus) q.set("status", filterStatus);

    Promise.all([
      fetch(`${API}/api/admin/withdraw-requests?${q}`,  { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch(`${API}/api/admin/withdraw-requests/summary`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
    ])
      .then(([listData, summaryData]) => {
        setRequests(listData.data ?? listData.docs ?? []);
        setTotalPages(listData.meta?.totalPages ?? 1);
        setSummary(summaryData.data ?? summaryData);
      })
      .catch(() => setRequests([]))
      .finally(() => setLoading(false));
  }, [token, page, filterStatus]);

  useEffect(() => { load(); }, [load]);

  const openReview = (r: WithdrawRequest) => {
    setReviewing(r);
    setAction("approved");
    setAdminNote("");
    setReviewError("");
  };

  const handleReview = async () => {
    if (!reviewing || submitting) return;
    setSubmitting(true);
    setReviewError("");
    try {
      const res = await fetch(`${API}/api/admin/withdraw-requests/${reviewing._id}/review`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action, adminNote }),
      });
      const data = await res.json();
      if (!res.ok) { setReviewError(data.message || "Action failed"); return; }
      setReviewing(null);
      load();
    } catch {
      setReviewError("Request failed — please try again");
    } finally {
      setSubmitting(false);
    }
  };

  const summaryItems: SummaryCardItem[] = [
    { label: "Total",       value: summary.total,    icon: ArrowDownCircle, tone: "default" },
    { label: "Pending",     value: summary.pending,  icon: Clock,           tone: "warn",   hint: "Needs processing" },
    { label: "Approved",    value: summary.approved, icon: CheckCircle2,    tone: "yes"     },
    { label: "Rejected",    value: summary.rejected, icon: XCircle,         tone: "no"      },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Withdraw Requests</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Review and process merchant withdrawal requests
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-50"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          Refresh
        </button>
      </div>

      {/* Summary cards */}
      <SummaryCards items={summaryItems} />

      {/* Filter */}
      <div className="flex items-center gap-1 rounded-lg border border-border bg-secondary p-1 w-fit">
        <Filter className="h-3.5 w-3.5 text-muted-foreground ml-1.5 mr-0.5" />
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => { setFilterStatus(f.key); setPage(1); }}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              filterStatus === f.key
                ? "bg-brand text-white"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className={TABLE.wrapper}>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : requests.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <ArrowDownCircle className="h-8 w-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No withdraw requests found</p>
          </div>
        ) : (
          <>
            <div className={TABLE.scroll}>
              <table className={TABLE.table}>
                <thead className={TABLE.thead}>
                  <tr>
                    <th className={TABLE.th}>Date</th>
                    <th className={TABLE.th}>Merchant</th>
                    <th className={TABLE.th}>Amount</th>
                    <th className={TABLE.th}>Method</th>
                    <th className={TABLE.th}>Payout Details</th>
                    <th className={TABLE.th}>Status</th>
                    <th className={TABLE.th}>Actions</th>
                  </tr>
                </thead>
                <tbody className={TABLE.tbody}>
                  {requests.map((r) => {
                    const ss = STATUS_STYLE[r.status];
                    const pm = PM_STYLE[r.paymentMethod];
                    const PMIcon = pm.icon;
                    const StatusIcon = ss.icon;

                    // Format payout destination concisely
                    let payoutLine = "—";
                    if (r.paymentMethod === "bank") {
                      payoutLine = [r.accountDetails.accountHolder, r.accountDetails.accountNumber, r.accountDetails.ifscCode].filter(Boolean).join(" · ");
                      if (r.accountDetails.bankName) payoutLine = `${r.accountDetails.bankName}: ${payoutLine}`;
                    } else if (r.paymentMethod === "upi") {
                      payoutLine = r.accountDetails.upiId || "—";
                    } else if (r.paymentMethod === "crypto") {
                      const addr = r.accountDetails.walletAddress || "";
                      payoutLine = addr ? `${addr.slice(0, 8)}…${addr.slice(-6)}` : "—";
                      if (r.accountDetails.network) payoutLine += ` (${r.accountDetails.network})`;
                    }

                    return (
                      <tr key={r._id} className={TABLE.row}>
                        <td className={TABLE.tdMuted}>{fmt(r.createdAt)}</td>
                        <td className={TABLE.td}>
                          <p className="font-medium text-foreground">{r.userId?.name ?? "—"}</p>
                          <p className="text-xs text-muted-foreground">{r.userId?.email}</p>
                        </td>
                        <td className={TABLE.td}>
                          <span className="font-mono font-semibold">${r.amount.toFixed(2)}</span>
                          <span className="ml-1 text-xs text-muted-foreground">{r.currency}</span>
                        </td>
                        <td className={TABLE.td}>
                          <span className={cn(
                            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
                            pm.bg, pm.color
                          )}>
                            <PMIcon className="h-3 w-3" />
                            {pm.label}
                          </span>
                        </td>
                        <td className={TABLE.tdMuted}>
                          <span className="font-mono text-xs">{payoutLine}</span>
                          {r.merchantNote && (
                            <p className="text-xs text-muted-foreground/70 mt-0.5 italic truncate max-w-[180px]">
                              {r.merchantNote}
                            </p>
                          )}
                        </td>
                        <td className={TABLE.td}>
                          <span className={cn(
                            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
                            ss.bg, ss.color
                          )}>
                            <StatusIcon className="h-3 w-3" />
                            {ss.label}
                          </span>
                          {r.reviewedBy && (
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              by {r.reviewedBy.name}
                            </p>
                          )}
                        </td>
                        <td className={TABLE.td}>
                          {r.status === "pending" ? (
                            <button
                              onClick={() => openReview(r)}
                              className="rounded-md border border-brand/30 bg-brand/10 px-2.5 py-1.5 text-[11px] font-semibold text-brand hover:bg-brand/20 transition-colors"
                            >
                              Review
                            </button>
                          ) : (
                            <span className="text-xs text-muted-foreground/50">
                              {r.adminNote || "—"}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className={TABLE.footer}>
                <span>Page {page} of {totalPages}</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage(page - 1)}
                    disabled={page <= 1}
                    className="flex items-center gap-1 rounded border border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-40 transition-colors"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" /> Prev
                  </button>
                  <button
                    onClick={() => setPage(page + 1)}
                    disabled={page >= totalPages}
                    className="flex items-center gap-1 rounded border border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-40 transition-colors"
                  >
                    Next <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Review Modal ── */}
      {reviewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">

            {/* Header */}
            <div className="flex items-start justify-between px-6 py-5 border-b border-border">
              <div className="flex-1 min-w-0 pr-4">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
                  Withdraw Request
                </p>
                <h2 className="text-base font-bold text-foreground">
                  ${reviewing.amount.toFixed(2)} {reviewing.currency}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {reviewing.userId?.name} · {reviewing.userId?.email}
                </p>
              </div>
              <button
                onClick={() => setReviewing(null)}
                className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Payout details */}
            <div className="px-6 py-4 space-y-2 border-b border-border">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Payout Details
              </p>
              {(() => {
                const pm = PM_STYLE[reviewing.paymentMethod];
                const PMIcon = pm.icon;
                const d = reviewing.accountDetails;
                const rows: { label: string; value: string }[] = [];

                if (reviewing.paymentMethod === "bank") {
                  if (d.bankName)       rows.push({ label: "Bank",           value: d.bankName });
                  if (d.accountHolder)  rows.push({ label: "Account Holder", value: d.accountHolder });
                  if (d.accountNumber)  rows.push({ label: "Account No.",    value: d.accountNumber });
                  if (d.ifscCode)       rows.push({ label: "IFSC",           value: d.ifscCode });
                } else if (reviewing.paymentMethod === "upi") {
                  if (d.upiId) rows.push({ label: "UPI ID", value: d.upiId });
                } else if (reviewing.paymentMethod === "crypto") {
                  if (d.walletAddress) rows.push({ label: "Address", value: d.walletAddress });
                  if (d.network)       rows.push({ label: "Network", value: d.network });
                }

                return (
                  <>
                    <div className="flex items-center gap-2 mb-3">
                      <span className={cn(
                        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
                        pm.bg, pm.color
                      )}>
                        <PMIcon className="h-3 w-3" />
                        {pm.label}
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {rows.map((row) => (
                        <div key={row.label} className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">{row.label}</span>
                          <span className="font-mono text-foreground font-medium">{row.value}</span>
                        </div>
                      ))}
                    </div>
                    {reviewing.merchantNote && (
                      <p className="text-xs text-muted-foreground mt-2 italic border-t border-border pt-2">
                        "{reviewing.merchantNote}"
                      </p>
                    )}
                  </>
                );
              })()}
            </div>

            {/* Action selection */}
            <div className="px-6 py-4 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Decision
              </p>
              <div className="grid grid-cols-2 gap-2">
                {(["approved", "rejected"] as const).map((opt) => {
                  const isSelected = action === opt;
                  const isApprove  = opt === "approved";
                  return (
                    <button
                      key={opt}
                      onClick={() => setAction(opt)}
                      className={cn(
                        "flex items-center justify-center gap-2 rounded-xl border-2 py-3 text-sm font-semibold transition-all",
                        isSelected && isApprove  && "border-yes/60 bg-yes/10 text-yes",
                        isSelected && !isApprove && "border-no/60 bg-no/10 text-no",
                        !isSelected              && "border-border bg-secondary/30 text-muted-foreground hover:bg-secondary/60"
                      )}
                    >
                      {isApprove
                        ? <CheckCircle2 className="h-4 w-4" />
                        : <XCircle      className="h-4 w-4" />
                      }
                      {isApprove ? "Approve" : "Reject"}
                    </button>
                  );
                })}
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  Admin Note {action === "rejected" && <span className="text-no">*</span>}
                </label>
                <textarea
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  placeholder={
                    action === "approved"
                      ? "e.g. Payment transferred via NEFT on 22-Apr-2026"
                      : "Reason for rejection…"
                  }
                  rows={2}
                  className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-brand transition-colors resize-none"
                />
              </div>

              {action === "rejected" && (
                <div className="flex items-start gap-2 rounded-lg border border-no/20 bg-no/10 p-3">
                  <XCircle className="h-4 w-4 text-no shrink-0 mt-0.5" />
                  <p className="text-xs text-muted-foreground">
                    Rejecting will <span className="font-semibold text-foreground">refund ${reviewing.amount.toFixed(2)}</span> back
                    to the merchant&apos;s wallet automatically.
                  </p>
                </div>
              )}

              {reviewError && <p className="text-xs text-no">{reviewError}</p>}
            </div>

            {/* Footer */}
            <div className="px-6 pb-5 flex flex-col gap-2">
              <button
                onClick={handleReview}
                disabled={submitting || (action === "rejected" && !adminNote.trim())}
                className={cn(
                  "w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white transition-all disabled:opacity-60",
                  action === "approved" ? "bg-yes hover:bg-yes/90" : "bg-no hover:bg-no/90"
                )}
              >
                {submitting
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Processing…</>
                  : action === "approved"
                    ? <><CheckCircle2 className="h-4 w-4" /> Confirm Approval</>
                    : <><XCircle      className="h-4 w-4" /> Confirm Rejection</>
                }
              </button>
              <button
                onClick={() => setReviewing(null)}
                className="w-full rounded-xl py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
