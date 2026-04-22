"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ArrowDownCircle, Clock, CheckCircle2, XCircle,
  ChevronLeft, ChevronRight, Loader2, Wallet,
  Building2, QrCode, AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";
import { TABLE } from "@/lib/table-styles";
import { SummaryCards, type SummaryCardItem } from "@/components/summary-cards";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

// ── Types ──────────────────────────────────────────────────────────────────────

type PaymentMethod = "bank" | "upi";

interface AccountDetails {
  bankName?: string;
  accountHolder?: string;
  accountNumber?: string;
  ifscCode?: string;
  upiId?: string;
}

interface WithdrawRequest {
  _id: string;
  amount: number;
  currency: string;
  paymentMethod: PaymentMethod;
  accountDetails: AccountDetails;
  merchantNote?: string;
  status: "pending" | "approved" | "rejected";
  adminNote?: string;
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
  bank: { label: "Bank Transfer", icon: Building2, color: "text-brand",   bg: "bg-brand/15"   },
  upi:  { label: "UPI",           icon: QrCode,    color: "text-chart-4", bg: "bg-chart-4/15" },
};

const STATUS_FILTERS = [
  { label: "All",      key: "" },
  { label: "Pending",  key: "pending" },
  { label: "Approved", key: "approved" },
  { label: "Rejected", key: "rejected" },
];

const PRESETS = [100, 500, 1000, 5000];

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function fmtAccountDetails(method: PaymentMethod, details: AccountDetails): string {
  if (method === "bank") {
    const parts = [details.bankName, details.accountNumber, details.ifscCode].filter(Boolean);
    return parts.join(" · ") || "—";
  }
  if (method === "upi") return details.upiId || "—";
  return "—";
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function MerchantWithdrawPage() {
  const { token } = useAuth();

  const [balance, setBalance]   = useState<number | null>(null);
  const [requests, setRequests] = useState<WithdrawRequest[]>([]);
  const [summary, setSummary]   = useState<Summary>({ pending: 0, approved: 0, rejected: 0, today: 0, total: 0 });
  const [loading, setLoading]   = useState(true);
  const [page, setPage]         = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filterStatus, setFilterStatus] = useState("");

  // Form state
  const [amount, setAmount]           = useState("");
  const [method, setMethod]           = useState<PaymentMethod>("bank");
  const [accountDetails, setDetails]  = useState<AccountDetails>({});
  const [merchantNote, setNote]       = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError]   = useState("");

  const loadBalance = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API}/api/merchant/wallet`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setBalance(data.data?.balance ?? 0);
    } catch {}
  }, [token]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const q = new URLSearchParams({ page: String(page), limit: "15" });
      if (filterStatus) q.set("status", filterStatus);

      const [listRes, summaryRes] = await Promise.all([
        fetch(`${API}/api/merchant/withdraw-requests?${q}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/api/merchant/withdraw-requests/summary`,  { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      const listData    = await listRes.json();
      const summaryData = await summaryRes.json();

      setRequests(listData.data ?? listData.docs ?? []);
      setTotalPages(listData.meta?.totalPages ?? 1);
      setSummary(summaryData.data ?? summaryData);
    } catch {
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, [token, page, filterStatus]);

  useEffect(() => { loadBalance(); }, [loadBalance]);
  useEffect(() => { load(); }, [load]);

  const setDetail = (key: keyof AccountDetails, val: string) =>
    setDetails((prev) => ({ ...prev, [key]: val }));

  const handleSubmit = async () => {
    setFormError("");
    const parsed = parseFloat(amount);
    if (!parsed || parsed <= 0) return setFormError("Enter a valid amount");
    if (balance !== null && parsed > balance)
      return setFormError(`Insufficient balance ($${balance.toFixed(2)} available)`);

    if (method === "bank") {
      if (!accountDetails.accountHolder?.trim()) return setFormError("Account holder name is required");
      if (!accountDetails.accountNumber?.trim()) return setFormError("Account number is required");
      if (!accountDetails.ifscCode?.trim())      return setFormError("IFSC code is required");
    }
    if (method === "upi" && !accountDetails.upiId?.trim()) return setFormError("UPI ID is required");

    setSubmitting(true);
    try {
      const res = await fetch(`${API}/api/merchant/withdraw-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount: parsed, paymentMethod: method, accountDetails, merchantNote }),
      });
      const data = await res.json();
      if (!res.ok) { setFormError(data.message || "Submission failed"); return; }

      toast.success("Withdraw request submitted!", {
        description: `$${parsed.toFixed(2)} has been held from your wallet and is pending admin review.`,
      });
      setAmount("");
      setDetails({});
      setNote("");
      await loadBalance();
      await load();
    } catch {
      setFormError("Request failed — please try again");
    } finally {
      setSubmitting(false);
    }
  };

  const summaryItems: SummaryCardItem[] = [
    { label: "Total",    value: summary.total,    icon: ArrowDownCircle, tone: "default" },
    { label: "Pending",  value: summary.pending,  icon: Clock,           tone: "warn",   hint: "Awaiting admin review" },
    { label: "Approved", value: summary.approved, icon: CheckCircle2,    tone: "yes"     },
    { label: "Rejected", value: summary.rejected, icon: XCircle,         tone: "no"      },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Withdraw</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Request a payout from your wallet balance
          </p>
        </div>
        {balance !== null && (
          <div className="flex items-center gap-2 rounded-xl border border-yes/20 bg-yes/10 px-4 py-2.5">
            <Wallet className="h-4 w-4 text-yes" />
            <div>
              <p className="text-[10px] text-muted-foreground leading-tight">Available Balance</p>
              <p className="text-base font-bold font-mono text-yes leading-tight">${balance.toFixed(2)}</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Request Form ── */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-5">
        <h2 className="text-sm font-semibold text-foreground">New Withdraw Request</h2>

        {/* Amount */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
            Amount (USDC) <span className="text-no">*</span>
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              min="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="flex-1 rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-brand transition-colors"
            />
          </div>
          <div className="flex gap-1.5 mt-2">
            {PRESETS.map((p) => (
              <button
                key={p}
                onClick={() => setAmount(String(p))}
                className="rounded-md border border-border bg-secondary px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors"
              >
                ${p}
              </button>
            ))}
            {balance !== null && balance > 0 && (
              <button
                onClick={() => setAmount(balance.toFixed(2))}
                className="rounded-md border border-brand/30 bg-brand/10 px-2.5 py-1 text-xs text-brand hover:bg-brand/20 transition-colors"
              >
                Max
              </button>
            )}
          </div>
        </div>

        {/* Payment Method */}
        <div>
          <label className="mb-2 block text-xs font-medium text-muted-foreground">
            Withdrawal Method <span className="text-no">*</span>
          </label>
          <div className="grid grid-cols-2 gap-2">
            {(Object.entries(PM_STYLE) as [PaymentMethod, typeof PM_STYLE[PaymentMethod]][]).map(([key, style]) => {
              const PMIcon = style.icon;
              const selected = method === key;
              return (
                <button
                  key={key}
                  onClick={() => { setMethod(key); setDetails({}); }}
                  className={cn(
                    "flex items-center gap-2 rounded-xl border-2 px-3 py-3 transition-all",
                    selected
                      ? "border-brand/60 bg-brand/10"
                      : "border-border bg-secondary/30 hover:bg-secondary/60"
                  )}
                >
                  <div className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                    selected ? style.bg : "bg-secondary"
                  )}>
                    <PMIcon className={cn("h-4 w-4", selected ? style.color : "text-muted-foreground")} />
                  </div>
                  <span className={cn("text-sm font-medium", selected ? "text-foreground" : "text-muted-foreground")}>
                    {style.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Account Details — dynamic by method */}
        {method === "bank" && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Bank Name</label>
              <input
                type="text"
                value={accountDetails.bankName ?? ""}
                onChange={(e) => setDetail("bankName", e.target.value)}
                placeholder="e.g. SBI, HDFC"
                className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-brand transition-colors"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Account Holder <span className="text-no">*</span>
              </label>
              <input
                type="text"
                value={accountDetails.accountHolder ?? ""}
                onChange={(e) => setDetail("accountHolder", e.target.value)}
                placeholder="Full name as on bank account"
                className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-brand transition-colors"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Account Number <span className="text-no">*</span>
              </label>
              <input
                type="text"
                value={accountDetails.accountNumber ?? ""}
                onChange={(e) => setDetail("accountNumber", e.target.value)}
                placeholder="Bank account number"
                className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-brand transition-colors"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                IFSC Code <span className="text-no">*</span>
              </label>
              <input
                type="text"
                value={accountDetails.ifscCode ?? ""}
                onChange={(e) => setDetail("ifscCode", e.target.value.toUpperCase())}
                placeholder="e.g. SBIN0001234"
                className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground outline-none focus:border-brand transition-colors"
              />
            </div>
          </div>
        )}

        {method === "upi" && (
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              UPI ID <span className="text-no">*</span>
            </label>
            <input
              type="text"
              value={accountDetails.upiId ?? ""}
              onChange={(e) => setDetail("upiId", e.target.value)}
              placeholder="yourname@upi"
              className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground outline-none focus:border-brand transition-colors"
            />
          </div>
        )}

        {/* Optional note */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Note (optional)</label>
          <input
            type="text"
            value={merchantNote}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Any additional instructions for admin..."
            className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-brand transition-colors"
          />
        </div>

        {/* Warning */}
        <div className="flex items-start gap-2.5 rounded-lg border border-chart-4/20 bg-chart-4/10 p-3">
          <AlertCircle className="h-4 w-4 text-chart-4 shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            The requested amount will be <span className="font-semibold text-foreground">immediately deducted</span> from
            your wallet balance and held until the admin processes your withdrawal.
            If rejected, the amount will be refunded automatically.
          </p>
        </div>

        {formError && <p className="text-xs text-no">{formError}</p>}

        <button
          onClick={handleSubmit}
          disabled={submitting || !amount}
          className="flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand/90 transition-colors disabled:opacity-50"
        >
          {submitting
            ? <><Loader2 className="h-4 w-4 animate-spin" /> Submitting…</>
            : <><ArrowDownCircle className="h-4 w-4" /> Submit Withdraw Request</>
          }
        </button>
      </div>

      {/* ── Summary cards ── */}
      <SummaryCards items={summaryItems} />

      {/* ── Filter ── */}
      <div className="flex items-center gap-1 rounded-lg border border-border bg-secondary p-1 w-fit">
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

      {/* ── Requests table ── */}
      <div className={TABLE.wrapper}>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : requests.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
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
                    <th className={TABLE.th}>Amount</th>
                    <th className={TABLE.th}>Method</th>
                    <th className={TABLE.th}>Account Details</th>
                    <th className={TABLE.th}>Status</th>
                    <th className={TABLE.th}>Admin Note</th>
                  </tr>
                </thead>
                <tbody className={TABLE.tbody}>
                  {requests.map((r) => {
                    const ss = STATUS_STYLE[r.status];
                    const pm = PM_STYLE[r.paymentMethod];
                    const PMIcon = pm.icon;
                    const StatusIcon = ss.icon;
                    return (
                      <tr key={r._id} className={TABLE.row}>
                        <td className={TABLE.tdMuted}>{fmt(r.createdAt)}</td>
                        <td className={TABLE.td}>
                          <span className="font-mono font-semibold text-foreground">
                            ${r.amount.toFixed(2)}
                          </span>
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
                          <span className="font-mono text-xs">
                            {fmtAccountDetails(r.paymentMethod, r.accountDetails)}
                          </span>
                        </td>
                        <td className={TABLE.td}>
                          <span className={cn(
                            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
                            ss.bg, ss.color
                          )}>
                            <StatusIcon className="h-3 w-3" />
                            {ss.label}
                          </span>
                        </td>
                        <td className={TABLE.tdMuted}>
                          {r.adminNote || <span className="text-muted-foreground/40">—</span>}
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
    </div>
  );
}
