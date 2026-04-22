"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Plus, Search, Loader2, UserCheck, UserX, X, Eye, EyeOff,
  Edit2, Trash2, Receipt, ChevronLeft, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";

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

export default function MerchantsPage() {
  const { token } = useAuth();
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [total, setTotal]         = useState(0);
  const [fetching, setFetching]   = useState(true);
  const [search, setSearch]       = useState("");

  // Modals
  const [showCreate, setShowCreate] = useState(false);
  const [editMerchant, setEditMerchant] = useState<Merchant | null>(null);
  const [viewMerchant, setViewMerchant] = useState<Merchant | null>(null);
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

  // Commission cache for edit
  const [editCommission, setEditCommission] = useState<CommissionRule | null>(null);

  // View commission
  const [viewCommission, setViewCommission] = useState<CommissionRule | null>(null);

  // Delete
  const [deleting, setDeleting] = useState(false);

  const fetchMerchants = useCallback(async () => {
    if (!token) return;
    setFetching(true);
    try {
      const res = await fetch(`${API}/api/admin/merchants?limit=50`, { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      setMerchants(json.data ?? []);
      setTotal(json.meta?.total ?? 0);
    } catch {} finally { setFetching(false); }
  }, [token]);

  useEffect(() => { fetchMerchants(); }, [fetchMerchants]);

  const loadCommission = async (merchantId: string): Promise<CommissionRule | null> => {
    try {
      const res = await fetch(`${API}/api/admin/merchants/${merchantId}/commission`, { headers: { Authorization: `Bearer ${token}` } });
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
          commissionThreshold: parseFloat(createForm.threshold),
          commissionFlatAmount: parseFloat(createForm.flatAmount),
          commissionPercentageRate: parseFloat(createForm.percentageRate),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Failed");
      setShowCreate(false);
      setCreateForm({ name: "", email: "", password: "", threshold: "100", flatAmount: "1", percentageRate: "2" });
      fetchMerchants();
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
      // Update merchant info
      const body: Record<string, string> = { name: editForm.name, email: editForm.email };
      if (editForm.password) body.password = editForm.password;
      const res = await fetch(`${API}/api/admin/merchants/${editMerchant._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Failed");

      // Update commission rule
      await fetch(`${API}/api/admin/merchants/${editMerchant._id}/commission`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          threshold: parseFloat(editForm.threshold),
          flatAmount: parseFloat(editForm.flatAmount),
          percentageRate: parseFloat(editForm.percentageRate),
          isActive: true,
        }),
      });

      setEditMerchant(null);
      fetchMerchants();
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
      fetchMerchants();
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

  const filtered = merchants.filter(m =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    m.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Merchants</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{total} total accounts</p>
        </div>
        <Button onClick={() => { setShowCreate(true); setCreateError(""); }}
          className="bg-brand hover:bg-brand/90 text-primary-foreground font-semibold flex items-center gap-1.5">
          <Plus className="h-4 w-4" /> Create Merchant
        </Button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary px-3 py-2 max-w-sm">
        <Search className="h-4 w-4 text-muted-foreground shrink-0" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search merchants..."
          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none" />
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/30">
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Name</th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Email</th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
              <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Wallet</th>
              <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Commission Paid</th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Joined</th>
              <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {fetching ? (
              <tr><td colSpan={7} className="px-5 py-10 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="px-5 py-10 text-center text-muted-foreground text-sm">No merchants found</td></tr>
            ) : (
              filtered.map(m => (
                <tr key={m._id} className="hover:bg-secondary/20 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand/20 text-brand text-xs font-bold shrink-0">
                        {m.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
                      </div>
                      <span className="text-sm font-medium text-foreground">{m.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{m.email}</td>
                  <td className="px-4 py-3">
                    <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold capitalize",
                      m.status === "active" ? "bg-yes/15 text-yes" : "bg-no/15 text-no")}>
                      {m.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-mono text-sm text-yes font-semibold">${(m.walletBalance ?? 0).toFixed(2)}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-mono text-sm text-chart-4">${(m.totalCommissionPaid ?? 0).toFixed(2)}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {new Date(m.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </td>
                  <td className="px-4 py-3">
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
                        className={cn("flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors ml-1",
                          m.status === "active" ? "bg-no/10 text-no hover:bg-no/20" : "bg-yes/10 text-yes hover:bg-yes/20")}>
                        {m.status === "active" ? <UserX className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />}
                        {m.status === "active" ? "Block" : "Unblock"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
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
              <InfoRow label="Name" value={viewMerchant.name} />
              <InfoRow label="Email" value={viewMerchant.email} />
              <InfoRow label="Status" value={viewMerchant.status} highlight={viewMerchant.status === "active"} />
              <InfoRow label="Wallet Balance" value={`$${viewMerchant.walletBalance.toFixed(2)}`} />
              <InfoRow label="Commission Paid" value={`$${viewMerchant.totalCommissionPaid.toFixed(2)}`} />
              <InfoRow label="Joined" value={new Date(viewMerchant.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} />
              <InfoRow label="Account ID" value={viewMerchant._id} mono />
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
      <p className={cn("text-sm font-semibold mt-0.5",
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
