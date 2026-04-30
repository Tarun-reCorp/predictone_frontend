"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ArrowDownCircle, Clock, CheckCircle2, XCircle,
  ChevronLeft, ChevronRight, Loader2, Wallet,
  Building2, QrCode, AlertCircle, Download,
  CalendarClock, ListChecks, X,
} from "lucide-react";
import * as XLSX from "xlsx";
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

interface Filters {
  paymentMethod: string;
  status:        string;
  minAmount:     string;
  maxAmount:     string;
  dateFrom:      string;
  dateTo:        string;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const EMPTY: Filters = {
  paymentMethod: "", status: "",
  minAmount: "", maxAmount: "", dateFrom: "", dateTo: "",
};

const STATUS_STYLE = {
  pending:  { label: "Pending",  color: "text-chart-4", bg: "bg-chart-4/15", icon: Clock        },
  approved: { label: "Approved", color: "text-yes",     bg: "bg-yes/15",     icon: CheckCircle2 },
  rejected: { label: "Rejected", color: "text-no",      bg: "bg-no/15",      icon: XCircle      },
};

const PM_STYLE: Record<PaymentMethod, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  bank: { label: "Bank Transfer", icon: Building2, color: "text-brand",   bg: "bg-brand/15"   },
  upi:  { label: "UPI",           icon: QrCode,    color: "text-chart-4", bg: "bg-chart-4/15" },
};

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

function buildParams(f: Filters, extra: Record<string, string> = {}) {
  const q = new URLSearchParams(extra);
  if (f.paymentMethod) q.set("paymentMethod", f.paymentMethod);
  if (f.status)        q.set("status",        f.status);
  if (f.minAmount)     q.set("minAmount",      f.minAmount);
  if (f.maxAmount)     q.set("maxAmount",      f.maxAmount);
  if (f.dateFrom)      q.set("dateFrom",       f.dateFrom);
  if (f.dateTo)        q.set("dateTo",         f.dateTo);
  return q;
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function MerchantWithdrawPage() {
  const { token } = useAuth();

  const [balance, setBalance]       = useState<number | null>(null);
  const [requests, setRequests]     = useState<WithdrawRequest[]>([]);
  const [summary, setSummary]       = useState<Summary>({ pending: 0, approved: 0, rejected: 0, today: 0, total: 0 });
  const [loading, setLoading]       = useState(true);
  const [page, setPage]             = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal]           = useState(0);
  const [filters, setFilters]       = useState<Filters>(EMPTY);
  const [datePreset, setDatePreset] = useState<"all" | "today" | "week" | "month">("all");
  const [exporting, setExporting]   = useState(false);

  // Form state
  const [amount, setAmount]          = useState("");
  const [method, setMethod]          = useState<PaymentMethod>("bank");
  const [accountDetails, setDetails] = useState<AccountDetails>({});
  const [merchantNote, setNote]      = useState("");
  const [submitting, setSubmitting]  = useState(false);
  const [formError, setFormError]    = useState("");

  const activeCount = Object.values(filters).filter(v => v !== "").length;

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

  const applyDatePreset = (preset: typeof datePreset) => {
    setDatePreset(preset); setPage(1);
    const today = new Date();
    const toStr = (d: Date) => d.toISOString().slice(0, 10);
    if (preset === "all") {
      setFilters(f => ({ ...f, dateFrom: "", dateTo: "" }));
    } else if (preset === "today") {
      const s = toStr(today);
      setFilters(f => ({ ...f, dateFrom: s, dateTo: s }));
    } else if (preset === "week") {
      const from = new Date(today); from.setDate(today.getDate() - 6);
      setFilters(f => ({ ...f, dateFrom: toStr(from), dateTo: toStr(today) }));
    } else if (preset === "month") {
      const from = new Date(today.getFullYear(), today.getMonth(), 1);
      setFilters(f => ({ ...f, dateFrom: toStr(from), dateTo: toStr(today) }));
    }
  };

  const fetchData = useCallback((pageNum: number, f: Filters, signal?: AbortSignal) => {
    if (!token) return;
    setLoading(true);
    const q = buildParams(f, { page: String(pageNum), limit: "15" });

    Promise.all([
      fetch(`${API}/api/merchant/withdraw-requests?${q}`, { headers: { Authorization: `Bearer ${token}` }, signal }).then(r => r.json()),
      fetch(`${API}/api/merchant/withdraw-requests/summary`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
    ])
      .then(([list, sum]) => {
        setRequests(list.data ?? list.docs ?? []);
        setTotalPages(list.meta?.totalPages ?? 1);
        setTotal(list.meta?.total ?? 0);
        if (sum?.data) setSummary(sum.data);
      })
      .catch(err => { if (err.name !== "AbortError") setRequests([]); })
      .finally(() => { if (!signal?.aborted) setLoading(false); });
  }, [token]);

  useEffect(() => { loadBalance(); }, [loadBalance]);

  useEffect(() => {
    const controller = new AbortController();
    const t = setTimeout(() => fetchData(page, filters, controller.signal), 400);
    return () => { clearTimeout(t); controller.abort(); };
  }, [page, filters, fetchData]);

  const set = (key: keyof Filters) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setPage(1);
      if (key === "dateFrom" || key === "dateTo") setDatePreset("all");
      setFilters(f => ({ ...f, [key]: e.target.value }));
    };

  const clearAll = () => { setFilters(EMPTY); setPage(1); setDatePreset("all"); };

  const exportToExcel = async () => {
    if (!token) return;
    setExporting(true);
    try {
      const q = buildParams(filters, { page: "1", limit: "5000" });
      const res  = await fetch(`${API}/api/merchant/withdraw-requests?${q}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      const rows: WithdrawRequest[] = data.data ?? data.docs ?? [];

      const sheet = rows.map((r, i) => ({
        "#":              i + 1,
        "Amount":         r.amount,
        "Currency":       r.currency,
        "Method":         r.paymentMethod,
        "Payout Details": fmtAccountDetails(r.paymentMethod, r.accountDetails),
        "Note":           r.merchantNote ?? "—",
        "Status":         r.status,
        "Admin Note":     r.adminNote ?? "—",
        "Submitted":      new Date(r.createdAt).toLocaleString("en-IN"),
      }));

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(sheet);
      ws["!cols"] = [
        { wch: 5 }, { wch: 10 }, { wch: 8 }, { wch: 10 },
        { wch: 36 }, { wch: 20 }, { wch: 10 }, { wch: 30 }, { wch: 22 },
      ];
      XLSX.utils.book_append_sheet(wb, ws, "Withdraw Requests");
      XLSX.writeFile(wb, `my_withdraw_requests_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch { /* silent */ }
    finally { setExporting(false); }
  };

  const setDetail = (key: keyof AccountDetails, val: string) =>
    setDetails(prev => ({ ...prev, [key]: val }));

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
      fetchData(page, filters);
    } catch {
      setFormError("Request failed — please try again");
    } finally {
      setSubmitting(false);
    }
  };

  const summaryItems: SummaryCardItem[] = [
    { label: "Total",    value: summary.total,    icon: ListChecks,    tone: "default" },
    { label: "Pending",  value: summary.pending,  icon: Clock,         tone: "warn",   hint: "Awaiting admin review" },
    { label: "Approved", value: summary.approved, icon: CheckCircle2,  tone: "yes"     },
    { label: "Today",    value: summary.today,    icon: CalendarClock, tone: "brand"   },
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
        <div className="flex items-center gap-2">
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
      </div>

      {/* ── Request Form ── */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-5">
        <h2 className="text-sm font-semibold text-foreground">New Withdraw Request</h2>

        {/* Amount */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
            Amount (USD) <span className="text-no">*</span>
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

      {/* ── Date presets + Summary cards ── */}
      <div className="space-y-2.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          {(["all", "today", "week", "month"] as const).map(p => {
            const label = { all: "All Time", today: "Today", week: "Last 7 Days", month: "This Month" }[p];
            return (
              <button key={p} onClick={() => applyDatePreset(p)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium border transition-colors",
                  datePreset === p
                    ? "bg-brand text-white border-brand"
                    : "bg-secondary/50 text-muted-foreground border-border hover:text-foreground hover:bg-secondary"
                )}>
                {label}
              </button>
            );
          })}
        </div>
        <SummaryCards items={summaryItems} />
      </div>

      {/* ── Filters + Export ── */}
      <div className="rounded-xl border border-border bg-card px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">

          {/* Method */}
          <select value={filters.paymentMethod} onChange={set("paymentMethod")}
            className="rounded-md border border-border bg-secondary/40 px-2.5 h-8 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-brand/50 w-32">
            <option value="">Method</option>
            <option value="bank">Bank</option>
            <option value="upi">UPI</option>
          </select>

          {/* Status */}
          <select value={filters.status} onChange={set("status")}
            className="rounded-md border border-border bg-secondary/40 px-2.5 h-8 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-brand/50 w-36">
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>

          {/* Amount range */}
          <div className="flex items-center gap-1">
            <input value={filters.minAmount} onChange={set("minAmount")} type="number" min="0"
              placeholder="Min $"
              className="w-20 rounded-md border border-border bg-secondary/40 px-2.5 h-8 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-brand/50 transition-colors" />
            <span className="text-muted-foreground text-xs">–</span>
            <input value={filters.maxAmount} onChange={set("maxAmount")} type="number" min="0"
              placeholder="Max $"
              className="w-20 rounded-md border border-border bg-secondary/40 px-2.5 h-8 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-brand/50 transition-colors" />
          </div>

          {/* Date range */}
          <div className="flex items-center gap-1">
            <input type="date" value={filters.dateFrom} onChange={set("dateFrom")}
              className="rounded-md border border-border bg-secondary/40 px-2 h-8 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-brand/50 transition-colors" />
            <span className="text-muted-foreground text-xs">–</span>
            <input type="date" value={filters.dateTo} onChange={set("dateTo")}
              className="rounded-md border border-border bg-secondary/40 px-2 h-8 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-brand/50 transition-colors" />
          </div>

          {activeCount > 0 && (
            <button onClick={clearAll}
              className="flex items-center gap-1 rounded-md border border-border bg-secondary/40 px-2.5 h-8 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors whitespace-nowrap">
              <X className="h-3 w-3" /> Clear ({activeCount})
            </button>
          )}

          <div className="flex-1" />

          <button
            onClick={exportToExcel}
            disabled={exporting || total === 0}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-secondary/50 hover:bg-secondary px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors"
          >
            {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            {exporting ? "Exporting…" : "Export Excel"}
          </button>
        </div>
      </div>

      {/* ── Requests table ── */}
      <div className={TABLE.wrapper}>
        {loading ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-border/60">
                {Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-4 py-3.5"><div className="h-3.5 w-6 rounded bg-secondary" /></td>
                    <td className="px-4 py-3.5"><div className="h-3.5 w-24 rounded bg-secondary" /></td>
                    <td className="px-4 py-3.5"><div className="h-3.5 w-16 rounded bg-secondary" /></td>
                    <td className="px-4 py-3.5"><div className="h-6 w-20 rounded-full bg-secondary" /></td>
                    <td className="px-4 py-3.5"><div className="h-3.5 w-40 rounded bg-secondary" /></td>
                    <td className="px-4 py-3.5"><div className="h-6 w-16 rounded-full bg-secondary" /></td>
                    <td className="px-4 py-3.5"><div className="h-3.5 w-32 rounded bg-secondary" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : requests.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
            <ArrowDownCircle className="h-8 w-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">
              {activeCount > 0 ? "No requests match the filters" : "No withdraw requests found"}
            </p>
            {activeCount > 0 && (
              <button onClick={clearAll} className="text-xs text-brand hover:underline mt-1">Clear filters</button>
            )}
          </div>
        ) : (
          <>
            <div className={TABLE.scroll}>
              <table className={TABLE.table}>
                <thead className={TABLE.thead}>
                  <tr>
                    <th className={TABLE.th}>#</th>
                    <th className={TABLE.th}>ID</th>
                    <th className={TABLE.th}>Date</th>
                    <th className={TABLE.thRight}>Amount</th>
                    <th className={TABLE.th}>Method</th>
                    <th className={TABLE.th}>Account Details</th>
                    <th className={TABLE.th}>Status</th>
                    <th className={TABLE.th}>Admin Note</th>
                  </tr>
                </thead>
                <tbody className={TABLE.tbody}>
                  {requests.map((r, idx) => {
                    const ss = STATUS_STYLE[r.status];
                    const pm = PM_STYLE[r.paymentMethod];
                    const PMIcon     = pm.icon;
                    const StatusIcon = ss.icon;
                    return (
                      <tr key={r._id} className={TABLE.row}>
                        <td className={TABLE.tdMuted}>{(page - 1) * 15 + idx + 1}</td>
                        <td className={TABLE.td}>
                          <span className="text-xs font-mono text-muted-foreground">{r._id}</span>
                        </td>
                        <td className={cn(TABLE.tdMuted, "whitespace-nowrap")}>{fmt(r.createdAt)}</td>
                        <td className={TABLE.tdRight}>
                          <span className="font-mono font-bold">${r.amount.toFixed(2)}</span>
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
                          {r.merchantNote && (
                            <p className="text-xs text-muted-foreground/70 mt-0.5 italic truncate max-w-[160px]">{r.merchantNote}</p>
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

            {/* Pagination — always visible */}
            <div className={TABLE.footer}>
              <span className="text-xs text-muted-foreground">
                Page <b>{page}</b> of <b>{totalPages}</b> — {total} total
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(p => p - 1)}
                  disabled={page <= 1}
                  className="flex items-center gap-1 rounded border border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-40 transition-colors"
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Prev
                </button>
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={page >= totalPages}
                  className="flex items-center gap-1 rounded border border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-40 transition-colors"
                >
                  Next <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
