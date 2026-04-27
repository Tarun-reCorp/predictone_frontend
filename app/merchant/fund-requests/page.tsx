"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowUpCircle, Clock, CheckCircle2, XCircle,
  ChevronLeft, ChevronRight, Loader2, Plus, X,
  CalendarClock, ListChecks, FileText, Download,
  QrCode, CreditCard, Bitcoin, AlertTriangle, RefreshCw,
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
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error" | "warn"; text: string } | null>(null);
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const cardCheckDone = useRef(false);

  // Form state
  const [showForm, setShowForm]   = useState(false);
  const [amount, setAmount]       = useState("");
  const [ref, setRef]             = useState("");
  const [note, setNote]           = useState("");
  const [method, setMethod]       = useState<"upi" | "card" | "crypto" | "manual">("manual");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError]   = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  // UTR submission modal for draft requests
  const [utrModal, setUtrModal] = useState<{
    requestId: string; orderId?: string; value: string; loading: boolean; error: string;
  } | null>(null);

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

  // ── Card payment auto-reject on gateway redirect ──────────────────────────
  // When card gateway redirects back with ?card_ord=CARD-xxx, check status
  // and reject the matching draft fund request if payment was declined/failed.
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
        const gwStatus = (statusData?.status ?? statusData?.payment_status ?? "").toLowerCase();

        // Only auto-reject on clear failure signals
        if (!["failed", "declined", "failure", "cancelled", "cancel", "rejected"].includes(gwStatus)) return;

        // 2. Find the matching fund request by orderId — draft OR pending
        const listRes = await fetch(`${API}/api/merchant/fund-requests?limit=50`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const listData = await listRes.json();
        const matched = (listData.data ?? []).find(
          (r: FundRequest) => r.orderId === cardOrd && ["draft", "pending"].includes(r.status)
        );
        if (!matched) return;

        // 3. Reject it with the gateway reason
        const reason = statusData?.message || statusData?.description
          || `Card payment ${gwStatus} by gateway (Order: ${cardOrd})`;
        await fetch(`${API}/api/merchant/fund-requests/${matched._id}/reject-failed`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ reason }),
        });

        setAutoRejectMsg(`Card payment was ${gwStatus}: ${reason}`);
        load();
      } catch {
        // silently ignore — don't block the page
      }
    })();
  }, [searchParams, token, load]);

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
        body: JSON.stringify({ amount: amt, paymentReference: ref, merchantNote: note, paymentMethod: method }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Failed");
      setFormSuccess("Fund request submitted! Admin will review it.");
      setAmount(""); setRef(""); setNote(""); setMethod("manual");
      setTimeout(() => { setShowForm(false); setFormSuccess(""); load(); }, 1500);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Failed to submit");
    } finally { setSubmitting(false); }
  };

  // ── Check payment status with gateway → auto-approve or auto-reject ────────
  const handleCheckStatus = async (req: FundRequest) => {
    setCheckingId(req._id);
    setStatusMsg(null);
    setAutoRejectMsg(null);
    try {
      const res = await fetch(`${API}/api/merchant/fund-requests/${req._id}/check-and-settle`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Status check failed");

      const { action, gwStatus, reason } = data.data ?? {};

      if (action === "approved") {
        setStatusMsg({
          type: "success",
          text: `Payment confirmed (${gwStatus}) — wallet credited successfully!`,
        });
      } else if (action === "rejected") {
        setStatusMsg({
          type: "error",
          text: `Payment ${gwStatus} — request rejected. Reason: ${reason}`,
        });
      } else {
        setStatusMsg({
          type: "warn",
          text: `Payment status: "${gwStatus}" — still processing. Try again in a few minutes.`,
        });
      }
      load();
    } catch (err: unknown) {
      setStatusMsg({
        type: "error",
        text: err instanceof Error ? err.message : "Status check failed",
      });
    } finally {
      setCheckingId(null);
    }
  };

  // Before showing UTR modal, check if UPI payment actually failed on the gateway.
  // If failed → auto-reject the fund request and show reason.
  // If success/pending or no orderId → open UTR modal normally.
  const handleOpenUtrModal = async (req: FundRequest) => {
    if (req.paymentMethod === "upi" && req.orderId) {
      try {
        const statusRes = await fetch(`${API}/api/payment/upi/payin/status`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ order_id: req.orderId }),
        });
        const statusData = await statusRes.json();
        const gwStatus = (statusData?.status ?? "").toLowerCase();

        if (["failed", "failure", "cancelled", "rejected", "declined"].includes(gwStatus)) {
          const reason = statusData?.message || statusData?.description
            || `UPI payment ${gwStatus} (Order: ${req.orderId})`;
          await fetch(`${API}/api/merchant/fund-requests/${req._id}/reject-failed`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ reason }),
          });
          setAutoRejectMsg(`UPI payment failed: ${reason}`);
          load();
          return;
        }
      } catch {
        // If status check fails, fall through to UTR modal — don't block the merchant
      }
    }
    setUtrModal({ requestId: req._id, orderId: req.orderId, value: "", loading: false, error: "" });
  };

  const handlePaymentDone = async () => {
    if (!utrModal) return;
    if (!utrModal.value.trim()) {
      setUtrModal(m => m ? { ...m, error: "UTR number is required" } : null);
      return;
    }
    setUtrModal(m => m ? { ...m, loading: true, error: "" } : null);
    try {
      const res = await fetch(`${API}/api/merchant/fund-requests/${utrModal.requestId}/submit-utr`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ utrNumber: utrModal.value.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Failed");
      setUtrModal(null);
      load();
    } catch (err: unknown) {
      setUtrModal(m => m ? { ...m, loading: false, error: err instanceof Error ? err.message : "Failed" } : null);
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
            Submit UTR / transaction references after paying to top-up your wallet.
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

      {/* Auto-reject banner (card redirect) */}
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

      {/* Check-status result banner */}
      {statusMsg && (
        <div className={cn(
          "flex items-start gap-3 rounded-xl border px-4 py-3",
          statusMsg.type === "success" && "border-yes/30 bg-yes/10",
          statusMsg.type === "error"   && "border-no/30 bg-no/10",
          statusMsg.type === "warn"    && "border-chart-4/30 bg-chart-4/10",
        )}>
          {statusMsg.type === "success" && <CheckCircle2 className="h-4 w-4 text-yes shrink-0 mt-0.5" />}
          {statusMsg.type === "error"   && <XCircle      className="h-4 w-4 text-no  shrink-0 mt-0.5" />}
          {statusMsg.type === "warn"    && <Clock        className="h-4 w-4 text-chart-4 shrink-0 mt-0.5" />}
          <p className={cn(
            "flex-1 text-sm",
            statusMsg.type === "success" && "text-yes",
            statusMsg.type === "error"   && "text-no",
            statusMsg.type === "warn"    && "text-chart-4",
          )}>{statusMsg.text}</p>
          <button onClick={() => setStatusMsg(null)} className="text-muted-foreground hover:text-foreground">
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

      {/* UTR submission modal */}
      {utrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <h2 className="text-base font-bold text-foreground">Submit UTR Number</h2>
              <button onClick={() => setUtrModal(null)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-6 flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">
                Enter the UTR / transaction reference number from your UPI app to confirm payment.
              </p>
              {utrModal.error && (
                <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-2.5 text-sm text-destructive">
                  {utrModal.error}
                </div>
              )}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground">UTR Number *</label>
                <input
                  type="text"
                  value={utrModal.value}
                  onChange={e => setUtrModal(m => m ? { ...m, value: e.target.value, error: "" } : null)}
                  placeholder="e.g. 425812345678"
                  autoFocus
                  className="w-full rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm text-foreground outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20"
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setUtrModal(null)}
                  className="flex-1 rounded-lg border border-border bg-secondary hover:bg-secondary/80 py-2.5 text-sm font-medium text-foreground transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePaymentDone}
                  disabled={utrModal.loading}
                  className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-brand hover:bg-brand/90 disabled:opacity-60 text-primary-foreground font-semibold py-2.5 text-sm transition-colors"
                >
                  {utrModal.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  {utrModal.loading ? "Submitting…" : "Confirm Payment"}
                </button>
              </div>
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
                            {req.status === "draft" && (
                              <button
                                onClick={() => handleOpenUtrModal(req)}
                                className="rounded-md bg-brand hover:bg-brand/90 text-primary-foreground text-xs font-semibold px-3 py-1.5 transition-colors whitespace-nowrap"
                              >
                                Payment Done
                              </button>
                            )}
                            {(req.paymentMethod === "upi" || req.paymentMethod === "card") &&
                              req.orderId &&
                              ["draft", "pending"].includes(req.status) && (
                              <button
                                onClick={() => handleCheckStatus(req)}
                                disabled={checkingId === req._id}
                                title="Check payment status with gateway"
                                className="flex items-center gap-1 rounded-md border border-border bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground text-xs font-medium px-2.5 py-1.5 transition-colors whitespace-nowrap disabled:opacity-50"
                              >
                                {checkingId === req._id
                                  ? <Loader2 className="h-3 w-3 animate-spin" />
                                  : <RefreshCw className="h-3 w-3" />}
                                {checkingId === req._id ? "Checking…" : "Check Status"}
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
    </div>
  );
}
