"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ArrowUpCircle, Clock, CheckCircle2, XCircle,
  ChevronLeft, ChevronRight, Loader2, Search, X, Download,
  CalendarClock, ListChecks, QrCode, CreditCard, Bitcoin, FileText,
  RefreshCw, ImageIcon,
} from "lucide-react";
import * as XLSX from "xlsx";
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
  paymentImage?: string;
  status: "pending" | "approved" | "rejected";
  adminNote?: string;
  reviewedBy?: { name: string };
  reviewedAt?: string;
  createdAt: string;
}

interface Summary {
  approved: number; pending: number; rejected: number; today: number; total: number;
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

const PM_STYLE = {
  upi:    { label: "UPI",    icon: QrCode,     color: "text-chart-4",          bg: "bg-chart-4/15" },
  card:   { label: "Card",   icon: CreditCard, color: "text-brand",            bg: "bg-brand/15"   },
  crypto: { label: "Crypto", icon: Bitcoin,    color: "text-yes",              bg: "bg-yes/15"     },
  manual: { label: "Manual", icon: FileText,   color: "text-muted-foreground", bg: "bg-secondary"  },
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

export default function AdminFundRequestsPage() {
  const { token } = useAuth();

  const [requests, setRequests]     = useState<FundRequest[]>([]);
  const [summary, setSummary]       = useState<Summary>({ approved: 0, pending: 0, rejected: 0, today: 0, total: 0 });
  const [loading, setLoading]       = useState(true);
  const [page, setPage]             = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal]           = useState(0);
  const [filters, setFilters]       = useState<Filters>(EMPTY);
  const [datePreset, setDatePreset] = useState<"all" | "today" | "week" | "month">("all");
  const [exporting, setExporting]   = useState(false);

  // Review modal
  const [reviewing, setReviewing]     = useState<FundRequest | null>(null);
  const [action, setAction]           = useState<"approved" | "rejected">("approved");
  const [adminNote, setAdminNote]     = useState("");
  const [submitting, setSubmitting]   = useState(false);
  const [reviewError, setReviewError] = useState("");

  // Status check
  const [checkingId, setCheckingId]         = useState<string | null>(null);
  const [statusResult, setStatusResult]     = useState<{ action: string; gwStatus: string; orderId: string } | null>(null);

  // Image viewer
  const [viewImage, setViewImage] = useState<string | null>(null);

  const activeCount = Object.values(filters).filter(v => v !== "").length;

  const applyDatePreset = (preset: typeof datePreset) => {
    setDatePreset(preset);
    setPage(1);
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
      fetch(`${API}/api/admin/fund-requests?${q}`, { headers: { Authorization: `Bearer ${token}` }, signal }).then(r => r.json()),
      fetch(`${API}/api/admin/fund-requests/summary`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
    ])
      .then(([list, sum]) => {
        setRequests(list.data ?? []);
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
      setReviewing(null); setAdminNote("");
      fetchData(page, filters);
    } catch (err: unknown) {
      setReviewError(err instanceof Error ? err.message : "Failed");
    } finally { setSubmitting(false); }
  };

  const handleCheckStatus = async (req: FundRequest) => {
    if (!req.orderId) return;
    setCheckingId(req._id);
    try {
      const res = await fetch(`${API}/api/admin/fund-requests/check-by-order-id`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ orderId: req.orderId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Failed");
      setStatusResult({ action: data.data?.action ?? "pending", gwStatus: data.data?.gwStatus ?? "unknown", orderId: req.orderId });
      fetchData(page, filters);
    } catch (err: unknown) {
      setStatusResult({ action: "error", gwStatus: err instanceof Error ? err.message : "Failed", orderId: req.orderId ?? "" });
    } finally {
      setCheckingId(null);
    }
  };

  const exportToExcel = async () => {
    if (!token) return;
    setExporting(true);
    try {
      const q = buildParams(filters, { page: "1", limit: "5000" });
      const res  = await fetch(`${API}/api/admin/fund-requests?${q}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      const rows: FundRequest[] = data.data ?? [];

      const sheet = rows.map((r, i) => ({
        "#":           i + 1,
        "Merchant":    r.userId?.name ?? "—",
        "Email":       r.userId?.email ?? "—",
        "Amount":      r.amount,
        "Currency":    r.currency,
        "Method":      r.paymentMethod ?? "manual",
        "Order ID":    r.orderId ?? "—",
        "UTR / Ref":   r.paymentReference ?? "—",
        "Status":      r.status,
        "Admin Note":  r.adminNote ?? "—",
        "Submitted":   new Date(r.createdAt).toLocaleString("en-IN"),
      }));

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(sheet);
      ws["!cols"] = [
        { wch: 5 }, { wch: 20 }, { wch: 26 }, { wch: 10 }, { wch: 8 },
        { wch: 8 }, { wch: 30 }, { wch: 22 }, { wch: 10 }, { wch: 30 }, { wch: 22 },
      ];
      XLSX.utils.book_append_sheet(wb, ws, "Fund Requests");
      XLSX.writeFile(wb, `fund_requests_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch { /* silent */ }
    finally { setExporting(false); }
  };

  const cards: SummaryCardItem[] = [
    { label: "Total",    value: summary.total,    icon: ListChecks,    tone: "default" },
    { label: "Approved", value: summary.approved, icon: CheckCircle2,  tone: "yes" },
    { label: "Pending",  value: summary.pending,  icon: Clock,         tone: "warn" },
    { label: "Today",    value: summary.today,    icon: CalendarClock, tone: "brand" },
  ];

  return (
    <div className="flex flex-col gap-4">

      {/* Heading */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Fund Requests</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Review merchant top-up requests and credit wallets.</p>
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
        <SummaryCards items={cards} />
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

          {/* Payment method */}
          <select value={filters.paymentMethod} onChange={set("paymentMethod")}
            className="rounded-md border border-border bg-secondary/40 px-2.5 h-8 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-brand/50 w-32">
            <option value="">Method</option>
            <option value="upi">UPI</option>
            <option value="card">Card</option>
            <option value="crypto">Crypto</option>
            <option value="manual">Manual</option>
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
              placeholder="Min ₹"
              className="w-20 rounded-md border border-border bg-secondary/40 px-2.5 h-8 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-brand/50 transition-colors" />
            <span className="text-muted-foreground text-xs">–</span>
            <input value={filters.maxAmount} onChange={set("maxAmount")} type="number" min="0"
              placeholder="Max ₹"
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
                {reviewing.paymentImage && (
                  <div className="px-4 py-3 flex flex-col gap-2">
                    <span className="text-xs text-muted-foreground">Payment Screenshot</span>
                    <img
                      src={`${API}/uploads/screenshot/${reviewing.paymentImage}`}
                      alt="Payment screenshot"
                      onClick={() => setViewImage(`${API}/uploads/screenshot/${reviewing.paymentImage}`)}
                      className="w-full max-h-48 object-contain rounded-lg border border-border cursor-pointer hover:opacity-90 transition-opacity"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setAction("approved")}
                  className={cn("flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-colors",
                    action === "approved" ? "bg-yes text-white" : "bg-secondary text-muted-foreground hover:text-foreground")}>
                  <CheckCircle2 className="h-4 w-4" /> Approve
                </button>
                <button onClick={() => setAction("rejected")}
                  className={cn("flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-colors",
                    action === "rejected" ? "bg-no text-white" : "bg-secondary text-muted-foreground hover:text-foreground")}>
                  <XCircle className="h-4 w-4" /> Reject
                </button>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground">Admin Note (optional)</label>
                <textarea value={adminNote} onChange={e => setAdminNote(e.target.value)} rows={2}
                  placeholder="Reason for approval/rejection..."
                  className="w-full rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm text-foreground outline-none focus:border-brand/50 resize-none" />
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

      {/* Status check result modal */}
      {statusResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card shadow-2xl">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h2 className="text-base font-bold text-foreground">Gateway Status Result</h2>
              <button onClick={() => setStatusResult(null)} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-6 flex flex-col gap-4">
              <div className="rounded-lg border border-border bg-secondary/50 divide-y divide-border/50">
                <div className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-xs text-muted-foreground">Order ID</span>
                  <span className="text-xs font-mono font-medium text-foreground">{statusResult.orderId}</span>
                </div>
                <div className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-xs text-muted-foreground">Gateway Status</span>
                  <span className="text-xs font-mono font-medium text-foreground uppercase">{statusResult.gwStatus}</span>
                </div>
                <div className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-xs text-muted-foreground">Action Taken</span>
                  <span className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
                    statusResult.action === "approved" ? "bg-yes/15 text-yes" :
                    statusResult.action === "rejected" ? "bg-no/15 text-no" :
                    statusResult.action === "error"    ? "bg-destructive/15 text-destructive" :
                    "bg-chart-4/15 text-chart-4"
                  )}>
                    {statusResult.action === "approved" && <CheckCircle2 className="h-3 w-3" />}
                    {statusResult.action === "rejected" && <XCircle className="h-3 w-3" />}
                    {statusResult.action === "pending"  && <Clock className="h-3 w-3" />}
                    {statusResult.action.charAt(0).toUpperCase() + statusResult.action.slice(1)}
                  </span>
                </div>
              </div>
              {statusResult.action === "error" && (
                <p className="text-xs text-destructive">{statusResult.gwStatus}</p>
              )}
              <button onClick={() => setStatusResult(null)}
                className="w-full rounded-lg border border-border bg-secondary py-2.5 text-sm font-medium text-foreground hover:bg-secondary/80 transition-colors">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

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
                    <td className="px-4 py-3.5"><div className="h-3.5 w-20 rounded bg-secondary" /></td>
                    <td className="px-4 py-3.5"><div className="h-3.5 w-24 rounded bg-secondary" /></td>
                    <td className="px-4 py-3.5"><div className="h-3.5 w-10 rounded bg-secondary" /></td>
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
            <ArrowUpCircle className="h-9 w-9 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">
              {activeCount > 0 ? "No requests match the filters" : "No fund requests"}
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
                    <th className={TABLE.th}>Merchant</th>
                    <th className={TABLE.thRight}>Amount</th>
                    <th className={TABLE.th}>Method</th>
                    <th className={TABLE.th}>Order ID</th>
                    <th className={TABLE.th}>UTR / Ref</th>
                    <th className={TABLE.th}>Image</th>
                    <th className={TABLE.th}>Status</th>
                    <th className={TABLE.thRight}>Balance</th>
                    <th className={TABLE.th}>Submitted</th>
                    <th className={TABLE.th}>Action</th>
                  </tr>
                </thead>
                <tbody className={TABLE.tbody}>
                  {requests.map((req, idx) => {
                    const s = STATUS_STYLE[req.status];
                    return (
                      <tr key={req._id} className={TABLE.row}>
                        <td className={TABLE.tdMuted}>{(page - 1) * 15 + idx + 1}</td>
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
                          {req.paymentImage ? (
                            <button
                              onClick={() => setViewImage(`${API}/uploads/screenshot/${req.paymentImage}`)}
                              className="flex items-center gap-1 rounded-md border border-border bg-secondary hover:bg-secondary/80 px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <ImageIcon className="h-3 w-3" /> View
                            </button>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
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
                            <div className="flex flex-col gap-1.5">
                              <button onClick={() => { setReviewing(req); setAction("approved"); setAdminNote(""); setReviewError(""); }}
                                className="flex items-center gap-1.5 rounded-md bg-brand/10 text-brand hover:bg-brand/20 px-3 py-1.5 text-xs font-semibold transition-colors">
                                Review
                              </button>
                              {req.orderId && (req.paymentMethod === "upi" || req.paymentMethod === "card") && (
                                <button
                                  onClick={() => handleCheckStatus(req)}
                                  disabled={checkingId === req._id}
                                  className="flex items-center gap-1.5 rounded-md bg-chart-4/10 text-chart-4 hover:bg-chart-4/20 px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50">
                                  {checkingId === req._id
                                    ? <Loader2 className="h-3 w-3 animate-spin" />
                                    : <RefreshCw className="h-3 w-3" />}
                                  {checkingId === req._id ? "Checking…" : "Check Status"}
                                </button>
                              )}
                            </div>
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
            <div className={TABLE.footer}>
              <span className="text-xs text-muted-foreground">Page <b>{page}</b> of <b>{totalPages}</b> &mdash; {total} total</span>
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
      {/* ── Image viewer modal ── */}
      {viewImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setViewImage(null)}
        >
          <div className="relative max-w-2xl w-full" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setViewImage(null)}
              className="absolute -top-10 right-0 text-white/70 hover:text-white transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
            <img
              src={viewImage}
              alt="Payment screenshot"
              className="w-full rounded-xl border border-border shadow-2xl object-contain max-h-[80vh]"
            />
          </div>
        </div>
      )}
    </div>
  );
}
