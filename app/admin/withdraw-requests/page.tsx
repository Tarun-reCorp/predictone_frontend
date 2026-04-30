"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ArrowDownCircle, Clock, CheckCircle2, XCircle,
  ChevronLeft, ChevronRight, Loader2, Search,
  Building2, QrCode, Bitcoin, X, RefreshCw,
  Download, CalendarClock, ListChecks,
} from "lucide-react";
import * as XLSX from "xlsx";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";
import { TABLE } from "@/lib/table-styles";
import { SummaryCards, type SummaryCardItem } from "@/components/summary-cards";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

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
  pending: number; approved: number; rejected: number; today: number; total: number;
}

interface Filters {
  merchantSearch: string;
  paymentMethod:  string;
  status:         string;
  minAmount:      string;
  maxAmount:      string;
  dateFrom:       string;
  dateTo:         string;
}

const EMPTY: Filters = {
  merchantSearch: "", paymentMethod: "", status: "",
  minAmount: "", maxAmount: "", dateFrom: "", dateTo: "",
};

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

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function buildParams(f: Filters, extra: Record<string, string> = {}) {
  const q = new URLSearchParams(extra);
  if (f.merchantSearch) q.set("merchantSearch", f.merchantSearch);
  if (f.paymentMethod)  q.set("paymentMethod",  f.paymentMethod);
  if (f.status)         q.set("status",         f.status);
  if (f.minAmount)      q.set("minAmount",       f.minAmount);
  if (f.maxAmount)      q.set("maxAmount",       f.maxAmount);
  if (f.dateFrom)       q.set("dateFrom",        f.dateFrom);
  if (f.dateTo)         q.set("dateTo",          f.dateTo);
  return q;
}

export default function AdminWithdrawRequestsPage() {
  const { token } = useAuth();

  const [requests, setRequests]     = useState<WithdrawRequest[]>([]);
  const [summary, setSummary]       = useState<Summary>({ pending: 0, approved: 0, rejected: 0, today: 0, total: 0 });
  const [loading, setLoading]       = useState(true);
  const [page, setPage]             = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal]           = useState(0);
  const [filters, setFilters]       = useState<Filters>(EMPTY);
  const [datePreset, setDatePreset] = useState<"all" | "today" | "week" | "month">("all");
  const [exporting, setExporting]   = useState(false);

  // Review modal
  const [reviewing, setReviewing]   = useState<WithdrawRequest | null>(null);
  const [action, setAction]         = useState<"approved" | "rejected">("approved");
  const [adminNote, setAdminNote]   = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState("");

  const activeCount = Object.values(filters).filter(v => v !== "").length;

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
      fetch(`${API}/api/admin/withdraw-requests?${q}`, { headers: { Authorization: `Bearer ${token}` }, signal }).then(r => r.json()),
      fetch(`${API}/api/admin/withdraw-requests/summary`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
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
      const res  = await fetch(`${API}/api/admin/withdraw-requests?${q}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      const rows: WithdrawRequest[] = data.data ?? data.docs ?? [];

      const sheet = rows.map((r, i) => {
        const d = r.accountDetails ?? {};
        let payoutDetails = "";
        if (r.paymentMethod === "bank") payoutDetails = [d.bankName, d.accountHolder, d.accountNumber, d.ifscCode].filter(Boolean).join(" | ");
        else if (r.paymentMethod === "upi") payoutDetails = d.upiId ?? "—";
        else if (r.paymentMethod === "crypto") payoutDetails = [d.walletAddress, d.network].filter(Boolean).join(" | ");
        return {
          "#":             i + 1,
          "Merchant":      r.userId?.name ?? "—",
          "Email":         r.userId?.email ?? "—",
          "Amount":        r.amount,
          "Currency":      r.currency,
          "Method":        r.paymentMethod,
          "Payout Details": payoutDetails || "—",
          "Note":          r.merchantNote ?? "—",
          "Status":        r.status,
          "Admin Note":    r.adminNote ?? "—",
          "Submitted":     new Date(r.createdAt).toLocaleString("en-IN"),
        };
      });

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(sheet);
      ws["!cols"] = [
        { wch: 5 }, { wch: 20 }, { wch: 26 }, { wch: 10 }, { wch: 8 },
        { wch: 8 }, { wch: 40 }, { wch: 20 }, { wch: 10 }, { wch: 30 }, { wch: 22 },
      ];
      XLSX.utils.book_append_sheet(wb, ws, "Withdraw Requests");
      XLSX.writeFile(wb, `withdraw_requests_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch { /* silent */ }
    finally { setExporting(false); }
  };

  const openReview = (r: WithdrawRequest) => {
    setReviewing(r); setAction("approved"); setAdminNote(""); setReviewError("");
  };

  const handleReview = async () => {
    if (!reviewing || submitting) return;
    setSubmitting(true); setReviewError("");
    try {
      const res = await fetch(`${API}/api/admin/withdraw-requests/${reviewing._id}/review`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action, adminNote }),
      });
      const data = await res.json();
      if (!res.ok) { setReviewError(data.message || "Action failed"); return; }
      setReviewing(null);
      fetchData(page, filters);
    } catch {
      setReviewError("Request failed — please try again");
    } finally { setSubmitting(false); }
  };

  const summaryItems: SummaryCardItem[] = [
    { label: "Total",    value: summary.total,    icon: ListChecks,      tone: "default" },
    { label: "Pending",  value: summary.pending,  icon: Clock,           tone: "warn",   hint: "Needs processing" },
    { label: "Approved", value: summary.approved, icon: CheckCircle2,    tone: "yes"     },
    { label: "Today",    value: summary.today,    icon: CalendarClock,   tone: "brand"   },
  ];

  return (
    <div className="flex flex-col gap-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Withdraw Requests</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Review and process merchant withdrawal requests</p>
        </div>
        <button
          onClick={exportToExcel}
          disabled={exporting || total === 0}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-secondary/50 hover:bg-secondary px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors"
        >
          {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
          {exporting ? "Exporting…" : "Export Excel"}
        </button>
      </div>

      {/* Date presets + Summary cards */}
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

      {/* Filters */}
      <div className="rounded-xl border border-border bg-card px-4 py-3">
        <div className="flex flex-wrap gap-2">

          {/* Merchant search */}
          <div className="relative flex-1 min-w-[160px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
            <input value={filters.merchantSearch} onChange={set("merchantSearch")}
              placeholder="Search merchant"
              className="w-full rounded-md border border-border bg-secondary/40 pl-7 pr-2.5 h-8 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-brand/50 focus:border-brand/50 transition-colors" />
          </div>

          {/* Method */}
          <select value={filters.paymentMethod} onChange={set("paymentMethod")}
            className="rounded-md border border-border bg-secondary/40 px-2.5 h-8 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-brand/50 w-32">
            <option value="">Method</option>
            <option value="bank">Bank</option>
            <option value="upi">UPI</option>
            <option value="crypto">Crypto</option>
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
        </div>
      </div>

      {/* Table */}
      <div className={TABLE.wrapper}>
        {loading ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-border/60">
                {Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-4 py-3.5"><div className="h-3.5 w-6 rounded bg-secondary" /></td>
                    <td className="px-4 py-3.5"><div className="h-3.5 w-28 rounded bg-secondary" /></td>
                    <td className="px-4 py-3.5"><div className="h-3.5 w-16 rounded bg-secondary" /></td>
                    <td className="px-4 py-3.5"><div className="h-6 w-20 rounded-full bg-secondary" /></td>
                    <td className="px-4 py-3.5"><div className="h-3.5 w-40 rounded bg-secondary" /></td>
                    <td className="px-4 py-3.5"><div className="h-6 w-16 rounded-full bg-secondary" /></td>
                    <td className="px-4 py-3.5"><div className="h-3.5 w-16 rounded bg-secondary" /></td>
                    <td className="px-4 py-3.5"><div className="h-3.5 w-24 rounded bg-secondary" /></td>
                    <td className="px-4 py-3.5"><div className="h-3.5 w-8 rounded bg-secondary" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : requests.length === 0 ? (
          <div className="flex flex-col items-center py-16 gap-2 text-center">
            <ArrowDownCircle className="h-9 w-9 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">
              {activeCount > 0 ? "No requests match the filters" : "No withdraw requests"}
            </p>
            {activeCount > 0 && (
              <button onClick={clearAll} className="text-xs text-brand hover:underline mt-1">Clear filters</button>
            )}
          </div>
        ) : (
          <>
            <div className={TABLE.scroll}>
              <table className={TABLE.table}>
                <thead>
                  <tr className={TABLE.thead}>
                    <th className={TABLE.th}>#</th>
                    <th className={TABLE.th}>ID</th>
                    <th className={TABLE.th}>Merchant</th>
                    <th className={TABLE.thRight}>Amount</th>
                    <th className={TABLE.th}>Method</th>
                    <th className={TABLE.th}>Payout Details</th>
                    <th className={TABLE.th}>Status</th>
                    <th className={TABLE.thRight}>Balance</th>
                    <th className={TABLE.th}>Submitted</th>
                    <th className={TABLE.th}>Action</th>
                  </tr>
                </thead>
                <tbody className={TABLE.tbody}>
                  {requests.map((r, idx) => {
                    const ss = STATUS_STYLE[r.status];
                    const pm = PM_STYLE[r.paymentMethod];
                    const PMIcon    = pm.icon;
                    const StatusIcon = ss.icon;

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
                        <td className={TABLE.tdMuted}>{(page - 1) * 15 + idx + 1}</td>
                        <td className={TABLE.td}>
                          <span className="text-xs font-mono text-muted-foreground">{r._id}</span>
                        </td>
                        <td className={TABLE.td}>
                          <p className="font-medium text-foreground">{r.userId?.name ?? "—"}</p>
                          <p className="text-xs text-muted-foreground">{r.userId?.email}</p>
                        </td>
                        <td className={TABLE.tdRight}>
                          <span className="font-mono font-bold">${r.amount.toFixed(2)}</span>
                          <span className="ml-1 text-xs text-muted-foreground">{r.currency}</span>
                        </td>
                        <td className={TABLE.td}>
                          <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", pm.bg, pm.color)}>
                            <PMIcon className="h-3 w-3" /> {pm.label}
                          </span>
                        </td>
                        <td className={cn(TABLE.tdMuted, "max-w-[200px]")}>
                          <p className="truncate font-mono text-xs">{payoutLine}</p>
                          {r.merchantNote && <p className="text-xs text-muted-foreground/70 mt-0.5 italic truncate">{r.merchantNote}</p>}
                        </td>
                        <td className={TABLE.td}>
                          <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", ss.bg, ss.color)}>
                            <StatusIcon className="h-3 w-3" /> {ss.label}
                          </span>
                          {r.reviewedBy && <p className="text-[10px] text-muted-foreground mt-0.5">by {r.reviewedBy.name}</p>}
                          {r.adminNote && <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[120px]">{r.adminNote}</p>}
                        </td>
                        <td className={cn(TABLE.tdRight, "font-mono text-yes")}>${(r.userId?.walletBalance ?? 0).toFixed(2)}</td>
                        <td className={cn(TABLE.tdMuted, "whitespace-nowrap")}>{fmt(r.createdAt)}</td>
                        <td className={TABLE.td}>
                          {r.status === "pending" ? (
                            <button onClick={() => openReview(r)}
                              className="rounded-md border border-brand/30 bg-brand/10 px-2.5 py-1.5 text-xs font-semibold text-brand hover:bg-brand/20 transition-colors">
                              Review
                            </button>
                          ) : (
                            <span className="text-xs text-muted-foreground/50">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className={TABLE.footer}>
              <span className="text-xs text-muted-foreground">Page <b>{page}</b> of <b>{totalPages}</b> — {total} total</span>
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
          </>
        )}
      </div>

      {/* ── Review Modal ── */}
      {reviewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
            <div className="flex items-start justify-between px-6 py-5 border-b border-border">
              <div className="flex-1 min-w-0 pr-4">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Withdraw Request</p>
                <h2 className="text-base font-bold text-foreground">${reviewing.amount.toFixed(2)} {reviewing.currency}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{reviewing.userId?.name} · {reviewing.userId?.email}</p>
              </div>
              <button onClick={() => setReviewing(null)}
                className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-6 py-4 space-y-2 border-b border-border">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Payout Details</p>
              {(() => {
                const pm = PM_STYLE[reviewing.paymentMethod];
                const PMIcon = pm.icon;
                const d = reviewing.accountDetails;
                const rows: { label: string; value: string }[] = [];
                if (reviewing.paymentMethod === "bank") {
                  if (d.bankName)      rows.push({ label: "Bank",           value: d.bankName });
                  if (d.accountHolder) rows.push({ label: "Account Holder", value: d.accountHolder });
                  if (d.accountNumber) rows.push({ label: "Account No.",    value: d.accountNumber });
                  if (d.ifscCode)      rows.push({ label: "IFSC",           value: d.ifscCode });
                } else if (reviewing.paymentMethod === "upi") {
                  if (d.upiId) rows.push({ label: "UPI ID", value: d.upiId });
                } else if (reviewing.paymentMethod === "crypto") {
                  if (d.walletAddress) rows.push({ label: "Address", value: d.walletAddress });
                  if (d.network)       rows.push({ label: "Network", value: d.network });
                }
                return (
                  <>
                    <div className="flex items-center gap-2 mb-3">
                      <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", pm.bg, pm.color)}>
                        <PMIcon className="h-3 w-3" /> {pm.label}
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {rows.map(row => (
                        <div key={row.label} className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">{row.label}</span>
                          <span className="font-mono text-foreground font-medium">{row.value}</span>
                        </div>
                      ))}
                    </div>
                    {reviewing.merchantNote && (
                      <p className="text-xs text-muted-foreground mt-2 italic border-t border-border pt-2">"{reviewing.merchantNote}"</p>
                    )}
                  </>
                );
              })()}
            </div>

            <div className="px-6 py-4 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Decision</p>
              <div className="grid grid-cols-2 gap-2">
                {(["approved", "rejected"] as const).map(opt => {
                  const isSelected = action === opt;
                  const isApprove  = opt === "approved";
                  return (
                    <button key={opt} onClick={() => setAction(opt)}
                      className={cn(
                        "flex items-center justify-center gap-2 rounded-xl border-2 py-3 text-sm font-semibold transition-all",
                        isSelected && isApprove  && "border-yes/60 bg-yes/10 text-yes",
                        isSelected && !isApprove && "border-no/60 bg-no/10 text-no",
                        !isSelected              && "border-border bg-secondary/30 text-muted-foreground hover:bg-secondary/60"
                      )}>
                      {isApprove ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                      {isApprove ? "Approve" : "Reject"}
                    </button>
                  );
                })}
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  Admin Note {action === "rejected" && <span className="text-no">*</span>}
                </label>
                <textarea value={adminNote} onChange={e => setAdminNote(e.target.value)} rows={2}
                  placeholder={action === "approved" ? "e.g. Payment transferred via NEFT" : "Reason for rejection…"}
                  className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-brand transition-colors resize-none" />
              </div>
              {action === "rejected" && (
                <div className="flex items-start gap-2 rounded-lg border border-no/20 bg-no/10 p-3">
                  <XCircle className="h-4 w-4 text-no shrink-0 mt-0.5" />
                  <p className="text-xs text-muted-foreground">
                    Rejecting will <span className="font-semibold text-foreground">refund ${reviewing.amount.toFixed(2)}</span> back to the merchant&apos;s wallet automatically.
                  </p>
                </div>
              )}
              {reviewError && <p className="text-xs text-no">{reviewError}</p>}
            </div>

            <div className="px-6 pb-5 flex flex-col gap-2">
              <button onClick={handleReview} disabled={submitting || (action === "rejected" && !adminNote.trim())}
                className={cn(
                  "w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white transition-all disabled:opacity-60",
                  action === "approved" ? "bg-yes hover:bg-yes/90" : "bg-no hover:bg-no/90"
                )}>
                {submitting
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Processing…</>
                  : action === "approved"
                    ? <><CheckCircle2 className="h-4 w-4" /> Confirm Approval</>
                    : <><XCircle      className="h-4 w-4" /> Confirm Rejection</>
                }
              </button>
              <button onClick={() => setReviewing(null)}
                className="w-full rounded-xl py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
