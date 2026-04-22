"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Search, RefreshCw, Filter, ChevronLeft, ChevronRight,
  TrendingUp, Plus, CheckCircle2, XCircle, Ban, X, Settings2,
} from "lucide-react";
import { formatVolume } from "@/lib/polymarket";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const PAGE_SIZE = 20;

const CATEGORIES = [
  "All", "Crypto", "Politics", "Sports", "Entertainment",
  "Business", "World News", "Technology", "Finance", "Other",
];

const ALL_MARKET_CATEGORIES = [
  "Crypto", "Politics", "Sports", "Entertainment", "Business",
  "World News", "Technology", "AI", "Science", "Culture", "Finance", "Other",
];

const STATUS_FILTERS = [
  { label: "All",       key: "" },
  { label: "Active",    key: "active" },
  { label: "Resolved",  key: "resolved" },
  { label: "Cancelled", key: "cancelled" },
];

interface DbMarket {
  _id: string;
  marketUniqueId: string;
  question: string;
  slug: string;
  category: string;
  status: string;
  active: boolean;
  closed: boolean;
  totalVolume: number;
  yesPool: number;
  noPool: number;
  yesPercent: number;
  noPercent: number;
  totalOrders: number;
  totalUsers: number;
  image?: string;
  endDate?: string;
  createdAt: string;
  result?: string | null;
}

type ActionType = "resolve-yes" | "resolve-no" | "cancel";

interface ManageModalState {
  market: DbMarket;
  selected: ActionType | null;
  loading: boolean;
  error: string | null;
}

const ACTIONS: Array<{
  key: ActionType;
  label: string;
  sublabel: string;
  icon: React.ElementType;
  rowCls: string;
  confirmCls: string;
}> = [
  {
    key: "resolve-yes",
    label: "Resolve as YES",
    sublabel: "Winners (YES bettors) receive profit payout based on their shares.",
    icon: CheckCircle2,
    rowCls: "border-yes/30 hover:bg-yes/5 hover:border-yes/60",
    confirmCls: "bg-yes text-white hover:bg-yes/90",
  },
  {
    key: "resolve-no",
    label: "Resolve as NO",
    sublabel: "Winners (NO bettors) receive profit payout based on their shares.",
    icon: XCircle,
    rowCls: "border-no/30 hover:bg-no/5 hover:border-no/60",
    confirmCls: "bg-no text-white hover:bg-no/90",
  },
  {
    key: "cancel",
    label: "Cancel Market",
    sublabel: "All bets cancelled — stake + commission fully refunded to every merchant.",
    icon: Ban,
    rowCls: "border-border hover:bg-secondary hover:border-muted-foreground/40",
    confirmCls: "bg-muted-foreground text-background hover:bg-muted-foreground/90",
  },
];

export default function AdminMarkets() {
  const { token } = useAuth();

  // List state
  const [markets, setMarkets]       = useState<DbMarket[]>([]);
  const [loading, setLoading]       = useState(true);
  const [syncing, setSyncing]       = useState(false);
  const [search, setSearch]         = useState("");
  const [category, setCategory]     = useState("");
  const [status, setStatus]         = useState("");
  const [page, setPage]             = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal]           = useState(0);

  // Create market modal
  const [createOpen, setCreateOpen]   = useState(false);
  const [creating, setCreating]       = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createForm, setCreateForm]   = useState({
    question: "", description: "", category: "Other", endDate: "",
  });

  // Manage market modal
  const [manageModal, setManageModal] = useState<ManageModalState | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      query.set("page", String(page));
      query.set("limit", String(PAGE_SIZE));
      if (category) query.set("category", category);
      if (status)   query.set("status",   status);

      if (search.trim().length >= 2) query.set("q", search.trim());
      const url = `${BACKEND}/api/markets/all?${query}`;

      const headers: Record<string, string> = { Accept: "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch(url, { headers });
      if (!res.ok) { setMarkets([]); return; }

      const json = await res.json();
      const list = json.data ?? [];
      setMarkets(Array.isArray(list) ? list : []);
      setTotal(json.meta?.total ?? list.length);
      setTotalPages(json.meta?.totalPages ?? 1);
    } catch {
      setMarkets([]);
    } finally {
      setLoading(false);
    }
  }, [page, category, status, search, token]);

  useEffect(() => { load(); }, [load]);

  const handleSync = async () => {
    if (!token || syncing) return;
    setSyncing(true);
    try {
      await fetch(`${BACKEND}/api/admin/markets/sync`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      await load();
    } catch {}
    setSyncing(false);
  };

  const handleSearch = (val: string) => {
    setSearch(val);
    setPage(1);
  };

  const openCreate = () => {
    setCreateForm({ question: "", description: "", category: "Other", endDate: "" });
    setCreateError(null);
    setCreateOpen(true);
  };

  const handleCreate = async () => {
    if (!token || creating || !createForm.question.trim()) return;
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch(`${BACKEND}/api/admin/markets`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          question:    createForm.question.trim(),
          description: createForm.description.trim() || undefined,
          category:    createForm.category,
          endDate:     createForm.endDate || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) { setCreateError(json.message || "Failed to create market"); return; }
      setCreateOpen(false);
      await load();
    } catch {
      setCreateError("Request failed — please try again");
    } finally {
      setCreating(false);
    }
  };

  const openManage = (market: DbMarket) => {
    setManageModal({ market, selected: null, loading: false, error: null });
  };

  const selectAction = (action: ActionType) => {
    setManageModal((m) => m ? { ...m, selected: action, error: null } : m);
  };

  const handleConfirm = async () => {
    if (!token || !manageModal || !manageModal.selected || manageModal.loading) return;
    setManageModal((m) => m ? { ...m, loading: true, error: null } : m);
    try {
      const { market, selected } = manageModal;
      const url = selected === "cancel"
        ? `${BACKEND}/api/admin/markets/${market._id}/cancel`
        : `${BACKEND}/api/admin/markets/${market._id}/resolve`;
      const body = selected === "cancel"
        ? {}
        : { result: selected === "resolve-yes" ? "yes" : "no" };

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        setManageModal((m) => m ? { ...m, loading: false, error: json.message || "Action failed" } : m);
        return;
      }
      setManageModal(null);
      await load();
    } catch {
      setManageModal((m) => m ? { ...m, loading: false, error: "Request failed — please try again" } : m);
    }
  };

  const STATUS_STYLE: Record<string, string> = {
    active:    "bg-yes/15 text-yes",
    closed:    "bg-muted-foreground/15 text-muted-foreground",
    resolved:  "bg-brand/15 text-brand",
    cancelled: "bg-no/15 text-no",
  };

  const canManage = (s: string) => s === "active" || s === "closed";

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Markets</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {total} markets in database
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={openCreate}
            className="flex items-center gap-1.5 rounded-lg border border-brand/30 bg-brand/10 px-3 py-1.5 text-xs font-medium text-brand hover:bg-brand/20 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Create Market
          </button>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", syncing && "animate-spin")} />
            Sync from Polymarket
          </button>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            Refresh
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            type="text"
            placeholder="Search markets..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
          />
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex items-center gap-1 rounded-lg border border-border bg-secondary p-1">
            <Filter className="h-3.5 w-3.5 text-muted-foreground ml-1.5 mr-0.5" />
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => { setStatus(f.key); setPage(1); }}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  status === f.key ? "bg-brand text-white" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 rounded-lg border border-border bg-secondary p-1 overflow-x-auto">
            <TrendingUp className="h-3.5 w-3.5 text-muted-foreground ml-1.5 mr-0.5 shrink-0" />
            {CATEGORIES.map((cat) => {
              const val = cat === "All" ? "" : cat;
              return (
                <button
                  key={cat}
                  onClick={() => { setCategory(val); setPage(1); }}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap",
                    category === val ? "bg-brand text-white" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">ID</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Market</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Category</th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Volume</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Yes / No</th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Orders</th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Users</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {loading
                ? Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 9 }).map((_, j) => (
                        <td key={j} className="px-5 py-4">
                          <div className="h-4 rounded bg-secondary animate-pulse" style={{ width: j === 1 ? "100%" : "60%" }} />
                        </td>
                      ))}
                    </tr>
                  ))
                : markets.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-5 py-14 text-center">
                        <p className="text-sm text-muted-foreground">No markets found</p>
                      </td>
                    </tr>
                  )
                : markets.map((m) => {
                    const hasVolume = m.totalVolume > 0;
                    const endDate = m.endDate
                      ? new Date(m.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" })
                      : null;
                    return (
                      <tr key={m._id} className="hover:bg-secondary/20 transition-colors">
                        <td className="px-4 py-3">
                          <span className="text-xs font-mono text-muted-foreground">{m.marketUniqueId}</span>
                        </td>
                        <td className="px-4 py-3 max-w-xs">
                          <p className="text-sm font-medium text-foreground truncate leading-snug">{m.question}</p>
                          {endDate && (
                            <p className="text-xs text-muted-foreground mt-0.5">Ends {endDate}</p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground">
                            {m.category}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-sm font-semibold text-foreground whitespace-nowrap">
                          {formatVolume(m.totalVolume)}
                        </td>
                        <td className="px-4 py-3">
                          {hasVolume ? (
                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-semibold text-yes">Yes</span>
                                <div className="w-12 h-1 rounded-full bg-secondary overflow-hidden">
                                  <div className="h-full bg-yes rounded-full" style={{ width: `${m.yesPercent}%` }} />
                                </div>
                                <span className="text-xs font-mono text-muted-foreground">{m.yesPercent.toFixed(0)}%</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-semibold text-no">No</span>
                                <div className="w-12 h-1 rounded-full bg-secondary overflow-hidden">
                                  <div className="h-full bg-no rounded-full" style={{ width: `${m.noPercent}%` }} />
                                </div>
                                <span className="text-xs font-mono text-muted-foreground">{m.noPercent.toFixed(0)}%</span>
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">No trades</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-sm text-muted-foreground">
                          {m.totalOrders}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-sm text-muted-foreground">
                          {m.totalUsers}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-0.5">
                            <span className={cn(
                              "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold w-fit capitalize",
                              STATUS_STYLE[m.status] ?? "bg-secondary text-muted-foreground"
                            )}>
                              {m.status}
                            </span>
                            {m.result && (
                              <span className="text-xs text-muted-foreground">
                                Result: <span className="font-semibold capitalize">{m.result}</span>
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            {canManage(m.status) && (
                              <button
                                onClick={() => openManage(m)}
                                className="flex items-center gap-1 rounded-md bg-brand px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-brand/85 transition-colors"
                              >
                                <Settings2 className="h-3 w-3" />
                                Resolve
                              </button>
                            )}
                            <a
                              href={`/market/${m.slug || m._id}`}
                              className="rounded-md border border-border bg-secondary px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors"
                            >
                              View
                            </a>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-secondary/20">
            <p className="text-xs text-muted-foreground">
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(page - 1)}
                disabled={page <= 1}
                className="flex items-center gap-1 rounded border border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-40 transition-colors"
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Prev
              </button>
              {Array.from({ length: Math.min(totalPages, 7) }).map((_, i) => {
                const p = i + 1;
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={cn(
                      "h-6 w-6 rounded text-xs font-medium transition-colors",
                      page === p ? "bg-brand text-white" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                    )}
                  >
                    {p}
                  </button>
                );
              })}
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
      </div>

      {/* ── Create Market Modal ───────────────────────────────────────────────── */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="text-sm font-semibold text-foreground">Create Market</h2>
              <button
                onClick={() => setCreateOpen(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4 p-5">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  Question <span className="text-no">*</span>
                </label>
                <input
                  type="text"
                  value={createForm.question}
                  onChange={(e) => setCreateForm((f) => ({ ...f, question: e.target.value }))}
                  placeholder="Will X happen before Y?"
                  className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-brand transition-colors"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Description</label>
                <textarea
                  value={createForm.description}
                  onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Optional context or resolution criteria..."
                  rows={3}
                  className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-brand transition-colors resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Category</label>
                  <select
                    value={createForm.category}
                    onChange={(e) => setCreateForm((f) => ({ ...f, category: e.target.value }))}
                    className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground outline-none focus:border-brand transition-colors"
                  >
                    {ALL_MARKET_CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">End Date</label>
                  <input
                    type="date"
                    value={createForm.endDate}
                    onChange={(e) => setCreateForm((f) => ({ ...f, endDate: e.target.value }))}
                    className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground outline-none focus:border-brand transition-colors"
                  />
                </div>
              </div>
              {createError && <p className="text-xs text-no">{createError}</p>}
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-4">
              <button
                onClick={() => setCreateOpen(false)}
                className="rounded-lg border border-border px-4 py-2 text-xs font-medium text-muted-foreground hover:bg-secondary transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !createForm.question.trim()}
                className="flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-xs font-medium text-white hover:bg-brand/90 transition-colors disabled:opacity-50"
              >
                {creating
                  ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  : <Plus className="h-3.5 w-3.5" />}
                Create Market
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Manage Market Modal ──────────────────────────────────────────────── */}
      {manageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">

            {/* Header */}
            <div className="flex items-start justify-between px-6 py-5 border-b border-border">
              <div className="flex-1 min-w-0 pr-4">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
                  {manageModal.market.marketUniqueId}
                </p>
                <h2 className="text-base font-bold text-foreground leading-snug line-clamp-2">
                  {manageModal.market.question}
                </h2>
              </div>
              <button
                onClick={() => setManageModal(null)}
                className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Action options */}
            <div className="px-6 py-4 space-y-2.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Select an action
              </p>
              {ACTIONS.map(({ key, label, sublabel, icon: Icon }) => {
                const isSelected = manageModal.selected === key;
                const isYes    = key === "resolve-yes";
                const isNo     = key === "resolve-no";
                const isCancel = key === "cancel";
                return (
                  <button
                    key={key}
                    onClick={() => selectAction(key)}
                    className={cn(
                      "w-full rounded-xl border-2 px-4 py-3.5 text-left transition-all duration-150",
                      !isSelected && "border-border bg-secondary/30 hover:bg-secondary/60 hover:border-border/80",
                      isSelected && isYes    && "border-yes/60 bg-yes/10",
                      isSelected && isNo     && "border-no/60 bg-no/10",
                      isSelected && isCancel && "border-chart-4/50 bg-chart-4/10",
                    )}
                  >
                    <div className="flex items-center gap-3">
                      {/* Icon circle */}
                      <div className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                        isYes    && (isSelected ? "bg-yes text-white"                   : "bg-yes/15 text-yes"),
                        isNo     && (isSelected ? "bg-no text-white"                    : "bg-no/15 text-no"),
                        isCancel && (isSelected ? "bg-chart-4 text-white"               : "bg-chart-4/15 text-chart-4"),
                      )}>
                        <Icon className="h-4 w-4" />
                      </div>

                      {/* Text */}
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          "text-sm font-semibold",
                          isSelected && isYes    && "text-yes",
                          isSelected && isNo     && "text-no",
                          isSelected && isCancel && "text-chart-4",
                          !isSelected            && "text-foreground",
                        )}>
                          {label}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                          {sublabel}
                        </p>
                      </div>

                      {/* Radio indicator */}
                      <div className={cn(
                        "h-4 w-4 shrink-0 rounded-full border-2 transition-all",
                        isSelected && isYes    && "border-yes bg-yes",
                        isSelected && isNo     && "border-no bg-no",
                        isSelected && isCancel && "border-chart-4 bg-chart-4",
                        !isSelected            && "border-border",
                      )}>
                        {isSelected && (
                          <div className="h-full w-full rounded-full flex items-center justify-center">
                            <div className="h-1.5 w-1.5 rounded-full bg-white" />
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Error */}
            {manageModal.error && (
              <div className="mx-6 mb-3 rounded-lg bg-no/10 border border-no/20 px-4 py-2.5 text-xs text-no">
                {manageModal.error}
              </div>
            )}

            {/* Footer */}
            <div className="px-6 pb-6 pt-2 flex flex-col gap-2">
              {manageModal.selected ? (() => {
                const action     = ACTIONS.find((a) => a.key === manageModal.selected)!;
                const ActionIcon = action.icon;
                const isYes    = action.key === "resolve-yes";
                const isNo     = action.key === "resolve-no";
                const isCancel = action.key === "cancel";
                return (
                  <button
                    onClick={handleConfirm}
                    disabled={manageModal.loading}
                    className={cn(
                      "w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white transition-all disabled:opacity-60",
                      isYes    && "bg-yes hover:bg-yes/90",
                      isNo     && "bg-no hover:bg-no/90",
                      isCancel && "bg-chart-4 hover:bg-chart-4/90",
                    )}
                  >
                    {manageModal.loading
                      ? <><RefreshCw className="h-4 w-4 animate-spin" /> Processing…</>
                      : <><ActionIcon className="h-4 w-4" /> Confirm — {action.label}</>
                    }
                  </button>
                );
              })() : (
                <div className="w-full rounded-xl py-3 text-center text-sm text-muted-foreground bg-secondary/50 select-none">
                  Select an action above
                </div>
              )}
              <button
                onClick={() => setManageModal(null)}
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
