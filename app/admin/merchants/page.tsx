"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Plus, Search, Loader2, UserCheck, UserX, X, Eye, EyeOff,
  Edit2, Trash2, Receipt, ChevronLeft, ChevronRight,
  Download, Users, CheckCircle2, CalendarClock,
} from "lucide-react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";
import { TABLE } from "@/lib/table-styles";
import { SummaryCards, type SummaryCardItem } from "@/components/summary-cards";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface Merchant {
  _id: string;
  name: string;
  email: string;
  status: "active" | "blocked";
  walletAddress: string | null;
  walletBalance: number;
  totalCommissionPaid: number;
  createdAt: string;
}

interface CommissionRule {
  threshold: number;
  flatAmount: number;
  percentageRate: number;
  isActive: boolean;
}

interface Summary {
  total: number;
  active: number;
  blocked: number;
  today: number;
}

interface Filters {
  search:   string;
  status:   string;
  dateFrom: string;
  dateTo:   string;
}

const EMPTY: Filters = { search: "", status: "", dateFrom: "", dateTo: "" };

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

export default function MerchantsPage() {
  const { token } = useAuth();

  const [merchants, setMerchants]   = useState<Merchant[]>([]);
  const [summary, setSummary]       = useState<Summary>({ total: 0, active: 0, blocked: 0, today: 0 });
  const [fetching, setFetching]     = useState(true);
  const [page, setPage]             = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal]           = useState(0);
  const [filters, setFilters]       = useState<Filters>(EMPTY);
  const [datePreset, setDatePreset] = useState<"all" | "today" | "week" | "month">("all");
  const [exporting, setExporting]   = useState(false);

  // Modals
  const [showCreate, setShowCreate]         = useState(false);
  const [editMerchant, setEditMerchant]     = useState<Merchant | null>(null);
  const [viewMerchant, setViewMerchant]     = useState<Merchant | null>(null);
  const [deleteMerchant, setDeleteMerchant] = useState<Merchant | null>(null);

  // Create form
  const [createForm, setCreateForm] = useState({ name: "", email: "", password: "", threshold: "100", flatAmount: "1", percentageRate: "2" });
  const [showPw, setShowPw]         = useState(false);
  const [creating, setCreating]     = useState(false);
  const [createError, setCreateError] = useState("");

  // Edit form
  const [editForm, setEditForm]     = useState({ name: "", email: "", password: "", threshold: "100", flatAmount: "1", percentageRate: "2" });
  const [editShowPw, setEditShowPw] = useState(false);
  const [saving, setSaving]         = useState(false);
  const [editError, setEditError]   = useState("");
  const [editCommission, setEditCommission] = useState<CommissionRule | null>(null);

  // View commission
  const [viewCommission, setViewCommission] = useState<CommissionRule | null>(null);

  // Delete
  const [deleting, setDeleting] = useState(false);

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

  const buildParams = (f: Filters, extra: Record<string, string> = {}) => {
    const q = new URLSearchParams(extra);
    if (f.search)   q.set("search",   f.search);
    if (f.status)   q.set("status",   f.status);
    if (f.dateFrom) q.set("dateFrom", f.dateFrom);
    if (f.dateTo)   q.set("dateTo",   f.dateTo);
    return q;
  };

  const fetchData = useCallback((pageNum: number, f: Filters, signal?: AbortSignal) => {
    if (!token) return;
    setFetching(true);
    const q = buildParams(f, { page: String(pageNum), limit: "20" });

    Promise.all([
      fetch(`${API}/api/admin/merchants?${q}`, { headers: { Authorization: `Bearer ${token}` }, signal }).then(r => r.json()),
      fetch(`${API}/api/admin/merchants/summary`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
    ])
      .then(([list, sum]) => {
        setMerchants(list.data ?? list.docs ?? []);
        setTotalPages(list.meta?.totalPages ?? 1);
        setTotal(list.meta?.total ?? 0);
        if (sum?.data) setSummary(sum.data);
      })
      .catch(err => { if (err.name !== "AbortError") setMerchants([]); })
      .finally(() => { if (!signal?.aborted) setFetching(false); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
      const res  = await fetch(`${API}/api/admin/merchants?${q}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      const rows: Merchant[] = data.data ?? data.docs ?? [];

      const sheet = rows.map((m, i) => ({
        "#":               i + 1,
        "Name":            m.name,
        "Email":           m.email,
        "Status":          m.status,
        "Wallet Balance":  m.walletBalance ?? 0,
        "Commission Paid": m.totalCommissionPaid ?? 0,
        "Joined":          new Date(m.createdAt).toLocaleString("en-IN"),
      }));

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(sheet);
      ws["!cols"] = [
        { wch: 5 }, { wch: 22 }, { wch: 28 }, { wch: 10 },
        { wch: 14 }, { wch: 16 }, { wch: 22 },
      ];
      XLSX.utils.book_append_sheet(wb, ws, "Merchants");
      XLSX.writeFile(wb, `merchants_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch { /* silent */ }
    finally { setExporting(false); }
  };

  const loadCommission = async (merchantId: string): Promise<CommissionRule | null> => {
    try {
      const res  = await fetch(`${API}/api/admin/merchants/${merchantId}/commission`, { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      return json.data?.rule ?? null;
    } catch { return null; }
  };

  // ── Create ──
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(""); setCreating(true);
    try {
      const res = await fetch(`${API}/api/admin/merchants`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: createForm.name, email: createForm.email, password: createForm.password,
          commissionThreshold:      parseFloat(createForm.threshold),
          commissionFlatAmount:     parseFloat(createForm.flatAmount),
          commissionPercentageRate: parseFloat(createForm.percentageRate),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Failed");
      setShowCreate(false);
      setCreateForm({ name: "", email: "", password: "", threshold: "100", flatAmount: "1", percentageRate: "2" });
      fetchData(page, filters);
    } catch (e: unknown) {
      setCreateError(e instanceof Error ? e.message : "Failed");
    } finally { setCreating(false); }
  };

  // ── Edit ──
  const openEdit = async (m: Merchant) => {
    setEditMerchant(m);
    setEditForm({ name: m.name, email: m.email, password: "", threshold: "100", flatAmount: "1", percentageRate: "2" });
    setEditError("");
    const rule = await loadCommission(m._id);
    setEditCommission(rule);
    if (rule) {
      setEditForm(f => ({ ...f, threshold: String(rule.threshold), flatAmount: String(rule.flatAmount), percentageRate: String(rule.percentageRate) }));
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editMerchant) return;
    setSaving(true); setEditError("");
    try {
      const body: Record<string, string> = { name: editForm.name, email: editForm.email };
      if (editForm.password) body.password = editForm.password;
      const res = await fetch(`${API}/api/admin/merchants/${editMerchant._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Failed");

      await fetch(`${API}/api/admin/merchants/${editMerchant._id}/commission`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          threshold:      parseFloat(editForm.threshold),
          flatAmount:     parseFloat(editForm.flatAmount),
          percentageRate: parseFloat(editForm.percentageRate),
          isActive:       true,
        }),
      });

      setEditMerchant(null);
      fetchData(page, filters);
    } catch (e: unknown) {
      setEditError(e instanceof Error ? e.message : "Failed");
    } finally { setSaving(false); }
  };

  // ── View ──
  const openView = async (m: Merchant) => {
    setViewMerchant(m);
    const rule = await loadCommission(m._id);
    setViewCommission(rule);
  };

  // ── Delete ──
  const handleDelete = async () => {
    if (!deleteMerchant) return;
    setDeleting(true);
    try {
      const res = await fetch(`${API}/api/admin/merchants/${deleteMerchant._id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { const json = await res.json(); throw new Error(json.message); }
      setDeleteMerchant(null);
      fetchData(page, filters);
    } catch {} finally { setDeleting(false); }
  };

  // ── Toggle Status ──
  const toggleStatus = async (id: string, current: "active" | "blocked") => {
    const next = current === "active" ? "blocked" : "active";
    await fetch(`${API}/api/admin/merchants/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status: next }),
    });
    setMerchants(prev => prev.map(m => m._id === id ? { ...m, status: next } : m));
  };

  const summaryItems: SummaryCardItem[] = [
    { label: "Total",   value: summary.total,   icon: Users,         tone: "default" },
    { label: "Active",  value: summary.active,  icon: CheckCircle2,  tone: "yes"     },
    { label: "Blocked", value: summary.blocked, icon: UserX,         tone: "no"      },
    { label: "Today",   value: summary.today,   icon: CalendarClock, tone: "brand"   },
  ];

  return (
    <div className="flex flex-col gap-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Merchants</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage merchant accounts and commission rules</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportToExcel}
            disabled={exporting || total === 0}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-secondary/50 hover:bg-secondary px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors"
          >
            {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            {exporting ? "Exporting…" : "Export Excel"}
          </button>
          <Button
            onClick={() => { setShowCreate(true); setCreateError(""); }}
            className="bg-brand hover:bg-brand/90 text-primary-foreground font-semibold flex items-center gap-1.5"
          >
            <Plus className="h-4 w-4" /> Create Merchant
          </Button>
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
        <SummaryCards items={summaryItems} />
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-border bg-card px-4 py-3">
        <div className="flex flex-wrap gap-2">

          {/* Search */}
          <div className="relative flex-1 min-w-[160px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
            <input
              value={filters.search} onChange={set("search")}
              placeholder="Search by name or email"
              className="w-full rounded-md border border-border bg-secondary/40 pl-7 pr-2.5 h-8 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-brand/50 focus:border-brand/50 transition-colors"
            />
          </div>

          {/* Status */}
          <select value={filters.status} onChange={set("status")}
            className="rounded-md border border-border bg-secondary/40 px-2.5 h-8 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-brand/50 w-36">
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="blocked">Blocked</option>
          </select>

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
        {fetching ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-border/60">
                {Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-4 py-3.5"><div className="h-3.5 w-6 rounded bg-secondary" /></td>
                    <td className="px-4 py-3.5"><div className="h-3.5 w-28 rounded bg-secondary" /></td>
                    <td className="px-4 py-3.5"><div className="h-3.5 w-36 rounded bg-secondary" /></td>
                    <td className="px-4 py-3.5"><div className="h-6 w-16 rounded-full bg-secondary" /></td>
                    <td className="px-4 py-3.5"><div className="h-3.5 w-16 rounded bg-secondary" /></td>
                    <td className="px-4 py-3.5"><div className="h-3.5 w-20 rounded bg-secondary" /></td>
                    <td className="px-4 py-3.5"><div className="h-3.5 w-24 rounded bg-secondary" /></td>
                    <td className="px-4 py-3.5"><div className="h-3.5 w-16 rounded bg-secondary" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : merchants.length === 0 ? (
          <div className="flex flex-col items-center py-16 gap-2 text-center">
            <Users className="h-9 w-9 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">
              {activeCount > 0 ? "No merchants match the filters" : "No merchants yet"}
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
                    <th className={TABLE.th}>Name</th>
                    <th className={TABLE.th}>Email</th>
                    <th className={TABLE.th}>Status</th>
                    <th className={TABLE.thRight}>Wallet</th>
                    <th className={TABLE.thRight}>Commission Paid</th>
                    <th className={TABLE.th}>Joined</th>
                    <th className={TABLE.thRight}>Actions</th>
                  </tr>
                </thead>
                <tbody className={TABLE.tbody}>
                  {merchants.map((m, idx) => (
                    <tr key={m._id} className={TABLE.row}>
                      <td className={TABLE.tdMuted}>{(page - 1) * 20 + idx + 1}</td>
                      <td className={TABLE.td}>
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand/20 text-brand text-xs font-bold shrink-0">
                            {m.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
                          </div>
                          <span className="text-sm font-medium text-foreground">{m.name}</span>
                        </div>
                      </td>
                      <td className={TABLE.tdMuted}>{m.email}</td>
                      <td className={TABLE.td}>
                        <span className={cn(
                          "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold capitalize",
                          m.status === "active" ? "bg-yes/15 text-yes" : "bg-no/15 text-no"
                        )}>
                          {m.status}
                        </span>
                      </td>
                      <td className={TABLE.tdRight}>
                        <span className="font-mono text-sm text-yes font-semibold">${(m.walletBalance ?? 0).toFixed(2)}</span>
                      </td>
                      <td className={TABLE.tdRight}>
                        <span className="font-mono text-sm text-chart-4">${(m.totalCommissionPaid ?? 0).toFixed(2)}</span>
                      </td>
                      <td className={TABLE.tdMuted}>{fmt(m.createdAt)}</td>
                      <td className={TABLE.td}>
                        <div className="flex items-center gap-1 justify-end">
                          <button onClick={() => openView(m)} title="View"
                            className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
                            <Eye className="h-4 w-4" />
                          </button>
                          <button onClick={() => openEdit(m)} title="Edit"
                            className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-brand/10 text-brand transition-colors">
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button onClick={() => setDeleteMerchant(m)} title="Delete"
                            className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-destructive/10 text-destructive transition-colors">
                            <Trash2 className="h-4 w-4" />
                          </button>
                          <button onClick={() => toggleStatus(m._id, m.status)}
                            className={cn(
                              "flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors ml-1",
                              m.status === "active" ? "bg-no/10 text-no hover:bg-no/20" : "bg-yes/10 text-yes hover:bg-yes/20"
                            )}>
                            {m.status === "active"
                              ? <><UserX className="h-3.5 w-3.5" /> Block</>
                              : <><UserCheck className="h-3.5 w-3.5" /> Unblock</>
                            }
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination — always visible */}
            <div className={TABLE.footer}>
              <span className="text-xs text-muted-foreground">
                Page <b>{page}</b> of <b>{totalPages}</b> — {total} total
              </span>
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

      {/* ── Create Modal ── */}
      {showCreate && (
        <Modal title="Create New Merchant" onClose={() => setShowCreate(false)}>
          <form onSubmit={handleCreate} className="p-6 flex flex-col gap-4">
            {createError && <ErrorMsg>{createError}</ErrorMsg>}
            <div className="grid grid-cols-2 gap-4">
              <Field label="Full Name">
                <input value={createForm.name} onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))} placeholder="John Doe" required className={inputCls} />
              </Field>
              <Field label="Email">
                <input type="email" value={createForm.email} onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))} placeholder="merchant@example.com" required className={inputCls} />
              </Field>
            </div>
            <Field label="Password">
              <PwInput value={createForm.password} onChange={v => setCreateForm(f => ({ ...f, password: v }))} show={showPw} onToggle={() => setShowPw(v => !v)} placeholder="Min 8 chars" required />
            </Field>
            <CommissionFields form={createForm} setForm={setCreateForm} />
            <div className="flex gap-3 pt-1">
              <Button type="button" variant="outline" className="flex-1 border-border" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button type="submit" className="flex-1 bg-brand hover:bg-brand/90 text-primary-foreground font-semibold" disabled={creating}>
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Edit Modal ── */}
      {editMerchant && (
        <Modal title={`Edit: ${editMerchant.name}`} onClose={() => setEditMerchant(null)}>
          <form onSubmit={handleEdit} className="p-6 flex flex-col gap-4">
            {editError && <ErrorMsg>{editError}</ErrorMsg>}
            <div className="grid grid-cols-2 gap-4">
              <Field label="Full Name">
                <input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} required className={inputCls} />
              </Field>
              <Field label="Email">
                <input type="email" value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} required className={inputCls} />
              </Field>
            </div>
            <Field label="New Password (leave blank to keep current)">
              <PwInput value={editForm.password} onChange={v => setEditForm(f => ({ ...f, password: v }))} show={editShowPw} onToggle={() => setEditShowPw(v => !v)} placeholder="Enter new password..." />
            </Field>
            <CommissionFields form={editForm} setForm={setEditForm} />
            <div className="flex gap-3 pt-1">
              <Button type="button" variant="outline" className="flex-1 border-border" onClick={() => setEditMerchant(null)}>Cancel</Button>
              <Button type="submit" className="flex-1 bg-brand hover:bg-brand/90 text-primary-foreground font-semibold" disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── View Modal ── */}
      {viewMerchant && (
        <Modal title={`Merchant: ${viewMerchant.name}`} onClose={() => setViewMerchant(null)}>
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <InfoRow label="Name"            value={viewMerchant.name} />
              <InfoRow label="Email"           value={viewMerchant.email} />
              <InfoRow label="Status"          value={viewMerchant.status} highlight={viewMerchant.status === "active"} />
              <InfoRow label="Wallet Balance"  value={`$${viewMerchant.walletBalance.toFixed(2)}`} />
              <InfoRow label="Commission Paid" value={`$${viewMerchant.totalCommissionPaid.toFixed(2)}`} />
              <InfoRow label="Joined"          value={new Date(viewMerchant.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} />
              <InfoRow label="Account ID"      value={viewMerchant._id} mono />
            </div>
            {viewCommission && (
              <div className="rounded-lg border border-brand/20 bg-brand/5 p-4">
                <p className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
                  <Receipt className="h-4 w-4 text-brand" /> Commission Rule
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <div><p className="text-xs text-muted-foreground">Threshold</p><p className="font-mono font-semibold text-foreground">${viewCommission.threshold}</p></div>
                  <div><p className="text-xs text-muted-foreground">Flat Fee</p><p className="font-mono font-semibold text-chart-4">${viewCommission.flatAmount}</p></div>
                  <div><p className="text-xs text-muted-foreground">% Rate</p><p className="font-mono font-semibold text-brand">{viewCommission.percentageRate}%</p></div>
                </div>
              </div>
            )}
            <Button variant="outline" className="w-full border-border" onClick={() => setViewMerchant(null)}>Close</Button>
          </div>
        </Modal>
      )}

      {/* ── Delete Confirm ── */}
      {deleteMerchant && (
        <Modal title="Delete Merchant" onClose={() => setDeleteMerchant(null)}>
          <div className="p-6 space-y-4">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete <strong className="text-foreground">{deleteMerchant.name}</strong> ({deleteMerchant.email})?
              This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 border-border" onClick={() => setDeleteMerchant(null)}>Cancel</Button>
              <Button onClick={handleDelete} disabled={deleting}
                className="flex-1 bg-destructive hover:bg-destructive/90 text-white font-semibold">
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                {deleting ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Shared sub-components ──

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-border px-6 py-4 sticky top-0 bg-card z-10">
          <h2 className="text-base font-bold text-foreground">{title}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-foreground">{label}</label>
      {children}
    </div>
  );
}

function PwInput({ value, onChange, show, onToggle, placeholder, required }: {
  value: string; onChange: (v: string) => void; show: boolean; onToggle: () => void; placeholder?: string; required?: boolean;
}) {
  return (
    <div className="relative">
      <input type={show ? "text" : "password"} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} required={required} className={cn(inputCls, "pr-10")} />
      <button type="button" onClick={onToggle} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

function CommissionFields({ form, setForm }: { form: { threshold: string; flatAmount: string; percentageRate: string }; setForm: (fn: (f: any) => any) => void }) {
  return (
    <div className="rounded-lg border border-brand/20 bg-brand/5 p-4 space-y-3">
      <p className="text-sm font-semibold text-foreground flex items-center gap-2"><Receipt className="h-4 w-4 text-brand" /> Commission Rules</p>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Threshold ($)">
          <input type="number" min="0" step="1" value={form.threshold} onChange={e => setForm((f: any) => ({ ...f, threshold: e.target.value }))} className={inputCls} />
        </Field>
        <Field label="Flat Fee ($)">
          <input type="number" min="0" step="0.01" value={form.flatAmount} onChange={e => setForm((f: any) => ({ ...f, flatAmount: e.target.value }))} className={inputCls} />
        </Field>
        <Field label="% Rate">
          <input type="number" min="0" max="100" step="0.1" value={form.percentageRate} onChange={e => setForm((f: any) => ({ ...f, percentageRate: e.target.value }))} className={inputCls} />
        </Field>
      </div>
      <p className="text-xs text-muted-foreground">
        Orders &lt; ${form.threshold} → ${form.flatAmount} flat · Orders ≥ ${form.threshold} → {form.percentageRate}%
      </p>
    </div>
  );
}

function InfoRow({ label, value, mono, highlight }: { label: string; value: string; mono?: boolean; highlight?: boolean }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn(
        "text-sm font-semibold mt-0.5",
        mono ? "font-mono text-xs text-foreground" : "",
        highlight ? "text-yes capitalize" : "text-foreground capitalize"
      )}>{value}</p>
    </div>
  );
}

function ErrorMsg({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-2.5 text-sm text-destructive">{children}</div>;
}

const inputCls = "w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-all focus:border-brand/50 focus:ring-1 focus:ring-brand/20";
