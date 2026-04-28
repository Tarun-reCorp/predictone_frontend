"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowUpCircle, Clock, CheckCircle2, XCircle,
  ChevronLeft, ChevronRight, Loader2, Plus, X,
  CalendarClock, ListChecks, FileText, Download,
  QrCode, CreditCard, Bitcoin, AlertTriangle, RefreshCw,
  Info, ImageIcon, Upload,
} from "lucide-react";
import * as XLSX from "xlsx";
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
  orderId?: string;
  paymentMethod?: "upi" | "card" | "crypto" | "manual";
  paymentImage?: string;
  status: "draft" | "pending" | "approved" | "rejected";
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
  draft:    { label: "Draft",    color: "text-muted-foreground", bg: "bg-secondary",   icon: FileText },
  pending:  { label: "Pending",  color: "text-chart-4",          bg: "bg-chart-4/15",  icon: Clock },
  approved: { label: "Approved", color: "text-yes",              bg: "bg-yes/15",       icon: CheckCircle2 },
  rejected: { label: "Rejected", color: "text-no",               bg: "bg-no/15",        icon: XCircle },
};

const PM_STYLE = {
  upi:    { label: "UPI",    icon: QrCode,      color: "text-chart-4", bg: "bg-chart-4/15" },
  card:   { label: "Card",   icon: CreditCard,  color: "text-brand",   bg: "bg-brand/15"   },
  crypto: { label: "Crypto", icon: Bitcoin,     color: "text-yes",     bg: "bg-yes/15"     },
  manual: { label: "Manual", icon: FileText,    color: "text-muted-foreground", bg: "bg-secondary" },
};

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function FundRequestsPage() {
  const { token } = useAuth();
  const searchParams = useSearchParams();
  const [requests, setRequests] = useState<FundRequest[]>([]);
  const [summary, setSummary]   = useState<Summary>({ approved: 0, pending: 0, rejected: 0, today: 0, total: 0 });
  const [loading, setLoading]   = useState(true);
  const [page, setPage]         = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filterStatus, setFilterStatus]   = useState("");
  const [filterMethod, setFilterMethod]   = useState("");
  const [minAmount, setMinAmount]         = useState("");
  const [maxAmount, setMaxAmount]         = useState("");
  const [dateFrom, setDateFrom]           = useState("");
  const [dateTo, setDateTo]               = useState("");
  const [datePreset, setDatePreset]       = useState<"all"|"today"|"week"|"month">("all");
  const [exporting, setExporting]         = useState(false);
  const [autoRejectMsg, setAutoRejectMsg] = useState<string | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const cardCheckDone = useRef(false);

  // Form state
  const [showForm, setShowForm]   = useState(false);
  const [amount, setAmount]       = useState("");
  const [ref, setRef]             = useState("");
  const [note, setNote]           = useState("");
  const [method, setMethod]       = useState<"upi" | "card" | "crypto" | "manual">("manual");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [viewImage, setViewImage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError]   = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  // Status popup modal (for Check Status button)
  const [statusModal, setStatusModal] = useState<{
    open: boolean;
    loading: boolean;
    req: FundRequest | null;
    action: "approved" | "rejected" | "pending" | "error" | null;
    gwStatus: string;
    reason: string;
    amount: number;
  }>({ open: false, loading: false, req: null, action: null, gwStatus: "", reason: "", amount: 0 });

  const load = useCallback(() => {
    if (!token) return;
    setLoading(true);
    const q = new URLSearchParams({ page: String(page), limit: "15" });
    if (filterStatus) q.set("status",        filterStatus);
    if (filterMethod) q.set("paymentMethod", filterMethod);
    if (minAmount)    q.set("minAmount",     minAmount);
    if (maxAmount)    q.set("maxAmount",     maxAmount);
    if (dateFrom)     q.set("dateFrom",      dateFrom);
    if (dateTo)       q.set("dateTo",        dateTo);

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
  }, [token, page, filterStatus, filterMethod, minAmount, maxAmount, dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  const applyDatePreset = (preset: typeof datePreset) => {
    setDatePreset(preset); setPage(1);
    const today = new Date();
    const toStr = (d: Date) => d.toISOString().slice(0, 10);
    if (preset === "all")   { setDateFrom(""); setDateTo(""); }
    else if (preset === "today") { setDateFrom(toStr(today)); setDateTo(toStr(today)); }
    else if (preset === "week")  { const f = new Date(today); f.setDate(today.getDate()-6); setDateFrom(toStr(f)); setDateTo(toStr(today)); }
    else if (preset === "month") { setDateFrom(toStr(new Date(today.getFullYear(), today.getMonth(), 1))); setDateTo(toStr(today)); }
  };

  const clearFilters = () => {
    setFilterStatus(""); setFilterMethod(""); setMinAmount(""); setMaxAmount("");
    setDateFrom(""); setDateTo(""); setDatePreset("all"); setPage(1);
  };

  const activeFilterCount = [filterStatus, filterMethod, minAmount, maxAmount, dateFrom, dateTo].filter(Boolean).length;

  const exportToExcel = async () => {
    if (!token) return;
    setExporting(true);
    try {
      const q = new URLSearchParams({ page: "1", limit: "5000" });
      if (filterStatus) q.set("status",        filterStatus);
      if (filterMethod) q.set("paymentMethod", filterMethod);
      if (minAmount)    q.set("minAmount",     minAmount);
      if (maxAmount)    q.set("maxAmount",     maxAmount);
      if (dateFrom)     q.set("dateFrom",      dateFrom);
      if (dateTo)       q.set("dateTo",        dateTo);
      const res  = await fetch(`${API}/api/merchant/fund-requests?${q}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      const rows: FundRequest[] = data.data ?? [];
      const sheet = rows.map((r, i) => ({
        "#":          i + 1,
        "Amount":     r.amount,
        "Currency":   r.currency,
        "Method":     r.paymentMethod ?? "manual",
        "Order ID":   r.orderId ?? "—",
        "UTR / Ref":  r.paymentReference ?? "—",
        "Note":       r.merchantNote ?? "—",
        "Status":     r.status,
        "Admin Note": r.adminNote ?? "—",
        "Date":       new Date(r.createdAt).toLocaleString("en-IN"),
      }));
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(sheet);
      ws["!cols"] = [{ wch: 4 }, { wch: 10 }, { wch: 8 }, { wch: 8 }, { wch: 30 }, { wch: 22 }, { wch: 20 }, { wch: 10 }, { wch: 30 }, { wch: 22 }];
      XLSX.utils.book_append_sheet(wb, ws, "Fund Requests");
      XLSX.writeFile(wb, `my_fund_requests_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch { /* silent */ }
    finally { setExporting(false); }
  };

  // ── Card payment auto-settle on gateway redirect ───────────────────────────
  // When card gateway redirects back with ?card_ord=CARD-xxx, check status
  // and auto-approve on success or auto-reject on failure.
  useEffect(() => {
    const cardOrd = searchParams.get("card_ord");
    if (!cardOrd || !token || cardCheckDone.current) return;
    cardCheckDone.current = true;

    // Clean URL param without page reload
    const url = new URL(window.location.href);
    url.searchParams.delete("card_ord");
    window.history.replaceState({}, "", url.toString());

    (async () => {
      try {
        // 1. Check card payment status from gateway
        const statusRes = await fetch(`${API}/api/payment/card/payin/status`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ order_ref_no: cardOrd }),
        });
        const statusData = await statusRes.json();
        const gwStatus   = (statusData?.status         ?? "").toLowerCase();
        const payStatus  = (statusData?.payment_status ?? "").toLowerCase();

        const FAILURE = ["failed", "declined", "failure", "cancelled", "cancel", "rejected"];
        const SUCCESS = ["success", "completed", "paid", "captured", "settlement", "settled"];

        // 2. Find the matching fund request by orderId — draft OR pending
        const listRes = await fetch(`${API}/api/merchant/fund-requests?limit=50`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const listData = await listRes.json();
        const matched = (listData.data ?? []).find(
          (r: FundRequest) => r.orderId === cardOrd && ["draft", "pending"].includes(r.status)
        );
        if (!matched) return;

        if (FAILURE.includes(gwStatus) || FAILURE.includes(payStatus)) {
          // Auto-reject
          const reason = statusData?.message || statusData?.description
            || `Card payment ${gwStatus || payStatus} by gateway (Order: ${cardOrd})`;
          await fetch(`${API}/api/merchant/fund-requests/${matched._id}/reject-failed`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ reason }),
          });
          setAutoRejectMsg(`Card payment failed: ${reason}`);
          load();
        } else if (SUCCESS.includes(payStatus)) {
          // Auto-approve via check-and-settle (payment_status is the reliable success field)
          const settleRes = await fetch(`${API}/api/merchant/fund-requests/${matched._id}/check-and-settle`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
          });
          const settleData = await settleRes.json();
          const { action, gwStatus: gw, reason } = settleData.data ?? {};
          setStatusModal({
            open: true, loading: false, req: matched,
            action: action ?? "pending",
            gwStatus: gw ?? payStatus,
            reason: reason ?? "",
            amount: matched.amount,
          });
          load();
        }
        // If status is unknown / pending → leave as draft, merchant can click "Check Status"
      } catch {
        // silently ignore — don't block the page
      }
    })();
  }, [searchParams, token, load]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setImageFile(file);
    if (file) {
      const reader = new FileReader();
      reader.onload = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      setImagePreview(null);
    }
  };

  const resetForm = () => {
    setAmount(""); setRef(""); setNote(""); setMethod("manual");
    setImageFile(null); setImagePreview(null);
    setFormError(""); setFormSuccess("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(""); setFormSuccess("");
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { setFormError("Please enter a valid amount"); return; }
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("amount", String(amt));
      fd.append("paymentMethod", method);
      if (ref.trim())  fd.append("paymentReference", ref.trim());
      if (note.trim()) fd.append("merchantNote", note.trim());
      if (imageFile)   fd.append("paymentImage", imageFile);

      const res = await fetch(`${API}/api/merchant/fund-requests`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }, // no Content-Type — let browser set multipart boundary
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Failed");
      setFormSuccess("Fund request submitted! Admin will review it.");
      resetForm();
      setTimeout(() => { setShowForm(false); load(); }, 1500);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Failed to submit");
    } finally { setSubmitting(false); }
  };

  // ── Payment Done: move draft → pending immediately (no UTR required) ─────────
  const handlePaymentDone = async (req: FundRequest) => {
    setSubmittingId(req._id);
    try {
      const res = await fetch(`${API}/api/merchant/fund-requests/${req._id}/submit-utr`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Failed");
      load();
    } catch {
      // silently ignore — list will still reload
    } finally {
      setSubmittingId(null);
    }
  };

  // ── Check Status: call check-and-settle, show result in popup modal ──────────
  const handleCheckStatus = async (req: FundRequest) => {
    setStatusModal({ open: true, loading: true, req, action: null, gwStatus: "", reason: "", amount: req.amount });
    try {
      const res = await fetch(`${API}/api/merchant/fund-requests/${req._id}/check-and-settle`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Status check failed");

      const { action, gwStatus, reason } = data.data ?? {};
      setStatusModal(m => ({ ...m, loading: false, action: action ?? "pending", gwStatus: gwStatus ?? "", reason: reason ?? "" }));
      load();
    } catch (err: unknown) {
      setStatusModal(m => ({
        ...m, loading: false, action: "error",
        reason: err instanceof Error ? err.message : "Status check failed",
      }));
    }
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
            After making a payment, click "Payment Done" to submit for review or "Check Status" to auto-verify.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportToExcel}
            disabled={exporting || requests.length === 0}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-secondary/50 hover:bg-secondary px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors"
          >
            {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            {exporting ? "Exporting…" : "Export"}
          </button>
          <button
            onClick={() => { setShowForm(true); setFormError(""); setFormSuccess(""); }}
            className="flex items-center gap-2 rounded-lg bg-brand hover:bg-brand/90 text-primary-foreground font-semibold px-4 py-2 text-sm transition-colors"
          >
            <Plus className="h-4 w-4" /> New Request
          </button>
        </div>
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
          {/* Method */}
          <select value={filterMethod} onChange={e => { setFilterMethod(e.target.value); setPage(1); }}
            className="rounded-md border border-border bg-secondary/40 px-2.5 h-8 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-brand/50 w-32">
            <option value="">Method</option>
            <option value="upi">UPI</option>
            <option value="card">Card</option>
            <option value="crypto">Crypto</option>
            <option value="manual">Manual</option>
          </select>

          {/* Status */}
          <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); }}
            className="rounded-md border border-border bg-secondary/40 px-2.5 h-8 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-brand/50 w-36">
            <option value="">All Status</option>
            <option value="draft">Draft</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>

          {/* Amount range */}
          <div className="flex items-center gap-1">
            <input value={minAmount} onChange={e => { setMinAmount(e.target.value); setPage(1); }} type="number" min="0"
              placeholder="Min ₹"
              className="w-20 rounded-md border border-border bg-secondary/40 px-2.5 h-8 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-brand/50 transition-colors" />
            <span className="text-muted-foreground text-xs">–</span>
            <input value={maxAmount} onChange={e => { setMaxAmount(e.target.value); setPage(1); }} type="number" min="0"
              placeholder="Max ₹"
              className="w-20 rounded-md border border-border bg-secondary/40 px-2.5 h-8 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-brand/50 transition-colors" />
          </div>

          {/* Date range */}
          <div className="flex items-center gap-1">
            <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setDatePreset("all"); setPage(1); }}
              className="rounded-md border border-border bg-secondary/40 px-2 h-8 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-brand/50 transition-colors" />
            <span className="text-muted-foreground text-xs">–</span>
            <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setDatePreset("all"); setPage(1); }}
              className="rounded-md border border-border bg-secondary/40 px-2 h-8 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-brand/50 transition-colors" />
          </div>

          {activeFilterCount > 0 && (
            <button onClick={clearFilters}
              className="flex items-center gap-1 rounded-md border border-border bg-secondary/40 px-2.5 h-8 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors whitespace-nowrap">
              <X className="h-3 w-3" /> Clear ({activeFilterCount})
            </button>
          )}
        </div>
      </div>

      {/* Auto-reject banner (card redirect failure) */}
      {autoRejectMsg && (
        <div className="flex items-start gap-3 rounded-xl border border-no/30 bg-no/10 px-4 py-3">
          <AlertTriangle className="h-4 w-4 text-no shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-no">Payment Failed — Request Rejected</p>
            <p className="text-xs text-muted-foreground mt-0.5">{autoRejectMsg}</p>
          </div>
          <button onClick={() => setAutoRejectMsg(null)} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* New request modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <h2 className="text-base font-bold text-foreground">New Fund Request</h2>
              <button onClick={() => { setShowForm(false); resetForm(); }} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
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
                <label className="text-sm font-medium text-foreground">Payment Method</label>
                <select
                  value={method}
                  onChange={e => setMethod(e.target.value as typeof method)}
                  className="w-full rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm text-foreground outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20"
                >
                  <option value="upi">UPI</option>
                  <option value="card">Card</option>
                  <option value="crypto">Crypto</option>
                  <option value="manual">Manual / Other</option>
                </select>
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

              {/* Payment screenshot (optional) */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground">
                  Payment Screenshot <span className="text-xs text-muted-foreground font-normal">(optional)</span>
                </label>
                {imagePreview ? (
                  <div className="relative">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="w-full max-h-40 object-contain rounded-lg border border-border bg-secondary"
                    />
                    <button
                      type="button"
                      onClick={() => { setImageFile(null); setImagePreview(null); }}
                      className="absolute top-1.5 right-1.5 rounded-full bg-black/60 p-1 text-white hover:bg-black/80 transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border bg-secondary/50 px-4 py-5 cursor-pointer hover:border-brand/40 hover:bg-secondary transition-colors">
                    <Upload className="h-5 w-5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Click to upload image (max 5MB)</span>
                    <span className="text-[10px] text-muted-foreground/60">JPEG, PNG, GIF, WEBP</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                      onChange={handleImageChange}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => { setShowForm(false); resetForm(); }}
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

      {/* ── Check Status popup modal ── */}
      {statusModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <h2 className="text-base font-bold text-foreground">Payment Status</h2>
              {!statusModal.loading && (
                <button
                  onClick={() => setStatusModal(m => ({ ...m, open: false }))}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="p-6 flex flex-col items-center gap-4 text-center">
              {/* Loading */}
              {statusModal.loading && (
                <>
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand/10">
                    <Loader2 className="h-7 w-7 animate-spin text-brand" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Checking with Gateway…</p>
                    <p className="text-xs text-muted-foreground mt-1">Please wait</p>
                  </div>
                </>
              )}

              {/* Approved */}
              {!statusModal.loading && statusModal.action === "approved" && (
                <>
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-yes/15">
                    <CheckCircle2 className="h-7 w-7 text-yes" />
                  </div>
                  <div>
                    <p className="text-base font-bold text-foreground">Payment Confirmed!</p>
                    <p className="text-xs text-muted-foreground mt-1">Wallet has been credited successfully.</p>
                  </div>
                  <div className="w-full rounded-lg border border-border bg-secondary/50 divide-y divide-border/50 text-xs">
                    <div className="flex items-center justify-between px-3 py-2.5">
                      <span className="text-muted-foreground">Gateway Status</span>
                      <span className="font-semibold text-yes capitalize">{statusModal.gwStatus}</span>
                    </div>
                    <div className="flex items-center justify-between px-3 py-2.5">
                      <span className="text-muted-foreground">Amount Credited</span>
                      <span className="font-mono font-semibold text-foreground">${statusModal.amount.toFixed(2)}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => setStatusModal(m => ({ ...m, open: false }))}
                    className="w-full rounded-lg bg-yes hover:bg-yes/90 text-white font-semibold py-2.5 text-sm transition-colors"
                  >
                    Done
                  </button>
                </>
              )}

              {/* Rejected */}
              {!statusModal.loading && statusModal.action === "rejected" && (
                <>
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-no/15">
                    <XCircle className="h-7 w-7 text-no" />
                  </div>
                  <div>
                    <p className="text-base font-bold text-foreground">Payment Failed</p>
                    <p className="text-xs text-muted-foreground mt-1">{statusModal.reason || `Gateway status: ${statusModal.gwStatus}`}</p>
                  </div>
                  <button
                    onClick={() => setStatusModal(m => ({ ...m, open: false }))}
                    className="w-full rounded-lg border border-border bg-secondary hover:bg-secondary/80 text-foreground font-semibold py-2.5 text-sm transition-colors"
                  >
                    Close
                  </button>
                </>
              )}

              {/* Pending / unknown */}
              {!statusModal.loading && statusModal.action === "pending" && (
                <>
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-chart-4/15">
                    <Clock className="h-7 w-7 text-chart-4" />
                  </div>
                  <div>
                    <p className="text-base font-bold text-foreground">Still Processing</p>
                    <p className="text-xs text-muted-foreground mt-1">Gateway status: <span className="font-semibold text-foreground capitalize">{statusModal.gwStatus || "pending"}</span></p>
                    <p className="text-xs text-muted-foreground mt-0.5">Try again in a few minutes.</p>
                  </div>
                  <div className="flex gap-2 w-full">
                    <button
                      onClick={() => setStatusModal(m => ({ ...m, open: false }))}
                      className="flex-1 rounded-lg border border-border bg-secondary hover:bg-secondary/80 text-foreground font-semibold py-2.5 text-sm transition-colors"
                    >
                      Close
                    </button>
                    {statusModal.req && (
                      <button
                        onClick={() => handleCheckStatus(statusModal.req!)}
                        className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-brand/40 bg-brand/10 hover:bg-brand/20 text-brand font-semibold py-2.5 text-sm transition-colors"
                      >
                        <RefreshCw className="h-3.5 w-3.5" /> Retry
                      </button>
                    )}
                  </div>
                </>
              )}

              {/* Error */}
              {!statusModal.loading && statusModal.action === "error" && (
                <>
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
                    <Info className="h-7 w-7 text-destructive" />
                  </div>
                  <div>
                    <p className="text-base font-bold text-foreground">Check Failed</p>
                    <p className="text-xs text-muted-foreground mt-1">{statusModal.reason}</p>
                  </div>
                  <button
                    onClick={() => setStatusModal(m => ({ ...m, open: false }))}
                    className="w-full rounded-lg border border-border bg-secondary hover:bg-secondary/80 text-foreground font-semibold py-2.5 text-sm transition-colors"
                  >
                    Close
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className={TABLE.wrapper}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <p className="text-sm font-semibold text-foreground">Request History</p>
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
                    <th className={TABLE.th}>Method</th>
                    <th className={TABLE.th}>Order ID</th>
                    <th className={TABLE.th}>UTR / Ref</th>
                    <th className={TABLE.th}>Note</th>
                    <th className={TABLE.th}>Image</th>
                    <th className={TABLE.th}>Status</th>
                    <th className={TABLE.th}>Admin Note</th>
                    <th className={TABLE.th}>Date</th>
                    <th className={TABLE.th}></th>
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
                        <td className={cn(TABLE.tdMuted, "max-w-[160px]")}>
                          <p className="truncate font-mono text-xs">{req.orderId || "—"}</p>
                        </td>
                        <td className={cn(TABLE.tdMuted, "max-w-[160px]")}>
                          <p className="truncate">{req.paymentReference || "—"}</p>
                        </td>
                        <td className={cn(TABLE.tdMuted, "max-w-[180px]")}>
                          <p className="truncate">{req.merchantNote || "—"}</p>
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
                        </td>
                        <td className={cn(TABLE.tdMuted, "max-w-[180px]")}>
                          <p className="truncate">{req.adminNote || "—"}</p>
                        </td>
                        <td className={cn(TABLE.tdMuted, "whitespace-nowrap")}>{fmt(req.createdAt)}</td>
                        <td className={TABLE.td}>
                          <div className="flex items-center gap-1.5">
                            {/* Payment Done: any draft → moves to pending immediately */}
                            {req.status === "draft" && (
                              <button
                                onClick={() => handlePaymentDone(req)}
                                disabled={submittingId === req._id}
                                className="flex items-center gap-1 rounded-md bg-brand hover:bg-brand/90 disabled:opacity-60 text-primary-foreground text-xs font-semibold px-3 py-1.5 transition-colors whitespace-nowrap"
                              >
                                {submittingId === req._id && <Loader2 className="h-3 w-3 animate-spin" />}
                                {submittingId === req._id ? "Submitting…" : "Payment Done"}
                              </button>
                            )}
                            {/* Check Status: UPI or card with orderId, in draft/pending */}
                            {(req.paymentMethod === "upi" || req.paymentMethod === "card") &&
                              req.orderId &&
                              ["draft", "pending"].includes(req.status) && (
                              <button
                                onClick={() => handleCheckStatus(req)}
                                title="Check payment status with gateway"
                                className="flex items-center gap-1 rounded-md border border-border bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground text-xs font-medium px-2.5 py-1.5 transition-colors whitespace-nowrap"
                              >
                                <RefreshCw className="h-3 w-3" />
                                Check Status
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className={TABLE.footer}>
              <span className="text-xs text-muted-foreground">Page <b>{page}</b> of <b>{totalPages}</b></span>
              <div className="flex gap-2">
                <button onClick={() => setPage(p => p - 1)} disabled={page <= 1}
                  className="flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors">
                  <ChevronLeft className="h-3.5 w-3.5" /> Prev
                </button>
                <button onClick={() => setPage(p => p + 1)} disabled={page >= totalPages}
                  className="flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors">
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
