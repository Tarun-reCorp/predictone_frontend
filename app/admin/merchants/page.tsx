"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Plus, Search, Loader2, UserCheck, UserX, X, Eye, EyeOff,
  Wallet, Receipt, ArrowUpCircle, ChevronDown, ChevronUp,
  Edit2, Check, DollarSign,
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
  const [showCreate, setShowCreate] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Commission rules cache
  const [commissionRules, setCommissionRules] = useState<Record<string, CommissionRule>>({});
  const [editingCommission, setEditingCommission] = useState<string | null>(null);
  const [commissionDraft, setCommissionDraft] = useState<CommissionRule>({ threshold: 100, flatAmount: 1, percentageRate: 2, isActive: true });
  const [savingCommission, setSavingCommission] = useState(false);

  // Wallet adjustment
  const [adjustingWallet, setAdjustingWallet] = useState<string | null>(null);
  const [adjustAmount, setAdjustAmount]       = useState("");
  const [adjustType, setAdjustType]           = useState<"admin_credit" | "admin_debit">("admin_credit");
  const [adjustDesc, setAdjustDesc]           = useState("");
  const [adjusting, setAdjusting]             = useState(false);
  const [adjustError, setAdjustError]         = useState("");

  // Create form
  const [form, setForm]         = useState({ name: "", email: "", password: "", threshold: "100", flatAmount: "1", percentageRate: "2" });
  const [showPw, setShowPw]     = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const fetchMerchants = useCallback(async () => {
    if (!token) return;
    setFetching(true);
    try {
      const res = await fetch(`${API}/api/admin/merchants?limit=50`, { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      setMerchants(json.data ?? []);
      setTotal(json.meta?.total ?? 0);
    } catch { } finally { setFetching(false); }
  }, [token]);

  useEffect(() => { fetchMerchants(); }, [fetchMerchants]);

  const loadCommissionRule = async (merchantId: string) => {
    if (commissionRules[merchantId] !== undefined) return;
    try {
      const res = await fetch(`${API}/api/admin/merchants/${merchantId}/commission`, { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      setCommissionRules(prev => ({ ...prev, [merchantId]: json.data?.rule ?? null }));
    } catch { }
  };

  const toggleExpand = async (merchantId: string) => {
    if (expandedId === merchantId) { setExpandedId(null); return; }
    setExpandedId(merchantId);
    await loadCommissionRule(merchantId);
  };

  const startEditCommission = (merchantId: string) => {
    const rule = commissionRules[merchantId];
    setCommissionDraft(rule ?? { threshold: 100, flatAmount: 1, percentageRate: 2, isActive: true });
    setEditingCommission(merchantId);
  };

  const saveCommission = async (merchantId: string) => {
    setSavingCommission(true);
    try {
      const res = await fetch(`${API}/api/admin/merchants/${merchantId}/commission`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(commissionDraft),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      setCommissionRules(prev => ({ ...prev, [merchantId]: json.data?.rule }));
      setEditingCommission(null);
    } catch { } finally { setSavingCommission(false); }
  };

  const handleWalletAdjust = async (merchantId: string) => {
    if (!adjustAmount || parseFloat(adjustAmount) <= 0) { setAdjustError("Enter a valid amount"); return; }
    setAdjusting(true); setAdjustError("");
    try {
      const res = await fetch(`${API}/api/admin/merchants/${merchantId}/wallet/adjust`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount: parseFloat(adjustAmount), type: adjustType, description: adjustDesc }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      setAdjustingWallet(null); setAdjustAmount(""); setAdjustDesc("");
      fetchMerchants(); // Refresh balances
    } catch (err: unknown) {
      setAdjustError(err instanceof Error ? err.message : "Failed");
    } finally { setAdjusting(false); }
  };

  const toggleStatus = async (id: string, current: "active" | "blocked") => {
    const next = current === "active" ? "blocked" : "active";
    await fetch(`${API}/api/admin/merchants/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status: next }),
    });
    setMerchants(prev => prev.map(m => m._id === id ? { ...m, status: next } : m));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(""); setCreating(true);
    try {
      const res = await fetch(`${API}/api/admin/merchants`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: form.name, email: form.email, password: form.password,
          commissionThreshold:      parseFloat(form.threshold),
          commissionFlatAmount:     parseFloat(form.flatAmount),
          commissionPercentageRate: parseFloat(form.percentageRate),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Failed");
      setShowCreate(false);
      setForm({ name: "", email: "", password: "", threshold: "100", flatAmount: "1", percentageRate: "2" });
      fetchMerchants();
    } catch (e: unknown) {
      setCreateError(e instanceof Error ? e.message : "Failed");
    } finally { setCreating(false); }
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

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <h2 className="text-base font-bold text-foreground">Create New Merchant</h2>
              <button onClick={() => setShowCreate(false)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>
            <form onSubmit={handleCreate} className="p-6 flex flex-col gap-4">
              {createError && <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-2.5 text-sm text-destructive">{createError}</div>}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Full Name">
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="John Doe" required className={inputCls} />
                </Field>
                <Field label="Email">
                  <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="merchant@example.com" required className={inputCls} />
                </Field>
              </div>

              <Field label="Password">
                <div className="relative">
                  <input type={showPw ? "text" : "password"} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    placeholder="Min 8 chars" required className={cn(inputCls, "pr-10")} />
                  <button type="button" onClick={() => setShowPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </Field>

              {/* Commission rules */}
              <div className="rounded-lg border border-brand/20 bg-brand/5 p-4 space-y-3">
                <p className="text-sm font-semibold text-foreground flex items-center gap-2"><Receipt className="h-4 w-4 text-brand" /> Commission Rules</p>
                <div className="grid grid-cols-3 gap-3">
                  <Field label="Threshold ($)">
                    <input type="number" min="0" step="1" value={form.threshold} onChange={e => setForm(f => ({ ...f, threshold: e.target.value }))} className={inputCls} />
                  </Field>
                  <Field label="Flat Fee ($)">
                    <input type="number" min="0" step="0.01" value={form.flatAmount} onChange={e => setForm(f => ({ ...f, flatAmount: e.target.value }))} className={inputCls} />
                  </Field>
                  <Field label="% Rate">
                    <input type="number" min="0" max="100" step="0.1" value={form.percentageRate} onChange={e => setForm(f => ({ ...f, percentageRate: e.target.value }))} className={inputCls} />
                  </Field>
                </div>
                <p className="text-xs text-muted-foreground">
                  Orders &lt; ${form.threshold} → ${form.flatAmount} flat · Orders ≥ ${form.threshold} → {form.percentageRate}%
                </p>
              </div>

              <div className="flex gap-3 pt-1">
                <Button type="button" variant="outline" className="flex-1 border-border" onClick={() => setShowCreate(false)}>Cancel</Button>
                <Button type="submit" className="flex-1 bg-brand hover:bg-brand/90 text-primary-foreground font-semibold" disabled={creating}>
                  {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

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
            <tr className="border-b border-border bg-secondary/50">
              <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Name</th>
              <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Email</th>
              <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Status</th>
              <th className="px-4 py-3 text-right font-semibold text-muted-foreground">Wallet</th>
              <th className="px-4 py-3 text-right font-semibold text-muted-foreground">Commission Paid</th>
              <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Joined</th>
              <th className="px-4 py-3 text-right font-semibold text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {fetching ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground text-sm">No merchants found</td></tr>
            ) : (
              filtered.map(m => (
                <>
                  <tr key={m._id} className="border-b border-border last:border-0 hover:bg-secondary/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand/20 text-brand text-[10px] font-bold shrink-0">
                          {m.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
                        </div>
                        <span className="font-medium text-foreground">{m.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{m.email}</td>
                    <td className="px-4 py-3">
                      <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold",
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
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(m.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => toggleStatus(m._id, m.status)}
                          className={cn("flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors",
                            m.status === "active" ? "bg-no/10 text-no hover:bg-no/20" : "bg-yes/10 text-yes hover:bg-yes/20")}>
                          {m.status === "active" ? <UserX className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />}
                          {m.status === "active" ? "Block" : "Unblock"}
                        </button>
                        <button onClick={() => toggleExpand(m._id)}
                          className="flex items-center gap-1 rounded-lg bg-secondary text-muted-foreground hover:text-foreground px-2 py-1.5 text-xs font-semibold transition-colors">
                          {expandedId === m._id ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                          Manage
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* Expanded row */}
                  {expandedId === m._id && (
                    <tr key={`${m._id}-expanded`} className="border-b border-border bg-secondary/10">
                      <td colSpan={7} className="px-6 py-5">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                          {/* Commission section */}
                          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                                <Receipt className="h-4 w-4 text-brand" /> Commission Rule
                              </p>
                              {editingCommission !== m._id ? (
                                <button onClick={() => startEditCommission(m._id)}
                                  className="flex items-center gap-1 text-xs text-brand hover:underline">
                                  <Edit2 className="h-3 w-3" /> Edit
                                </button>
                              ) : (
                                <div className="flex gap-2">
                                  <button onClick={() => saveCommission(m._id)} disabled={savingCommission}
                                    className="flex items-center gap-1 text-xs text-yes hover:underline">
                                    {savingCommission ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} Save
                                  </button>
                                  <button onClick={() => setEditingCommission(null)} className="flex items-center gap-1 text-xs text-muted-foreground hover:underline">
                                    <X className="h-3 w-3" /> Cancel
                                  </button>
                                </div>
                              )}
                            </div>
                            {editingCommission === m._id ? (
                              <div className="grid grid-cols-3 gap-3">
                                {[
                                  { label: "Threshold ($)", key: "threshold" as const, step: "1" },
                                  { label: "Flat Fee ($)",  key: "flatAmount" as const,  step: "0.01" },
                                  { label: "% Rate",       key: "percentageRate" as const, step: "0.1" },
                                ].map(f => (
                                  <div key={f.key} className="flex flex-col gap-1">
                                    <label className="text-xs text-muted-foreground">{f.label}</label>
                                    <input type="number" min="0" step={f.step}
                                      value={commissionDraft[f.key] as number}
                                      onChange={e => setCommissionDraft(d => ({ ...d, [f.key]: parseFloat(e.target.value) }))}
                                      className="rounded border border-border bg-secondary px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-brand/50"
                                    />
                                  </div>
                                ))}
                              </div>
                            ) : commissionRules[m._id] ? (
                              <div className="grid grid-cols-3 gap-3 text-sm">
                                <div><p className="text-xs text-muted-foreground">Threshold</p><p className="font-mono font-semibold text-foreground">${commissionRules[m._id].threshold}</p></div>
                                <div><p className="text-xs text-muted-foreground">Flat Fee</p><p className="font-mono font-semibold text-chart-4">${commissionRules[m._id].flatAmount}</p></div>
                                <div><p className="text-xs text-muted-foreground">% Rate</p><p className="font-mono font-semibold text-brand">{commissionRules[m._id].percentageRate}%</p></div>
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground">No commission rule set.
                                <button onClick={() => startEditCommission(m._id)} className="ml-1 text-brand hover:underline">Add one</button>
                              </p>
                            )}
                          </div>

                          {/* Wallet adjustment section */}
                          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                                <Wallet className="h-4 w-4 text-yes" /> Wallet Adjustment
                              </p>
                              <span className="text-sm font-mono font-bold text-yes">${(m.walletBalance ?? 0).toFixed(2)}</span>
                            </div>
                            {adjustingWallet === m._id ? (
                              <div className="space-y-3">
                                <div className="grid grid-cols-2 gap-2">
                                  <button onClick={() => setAdjustType("admin_credit")}
                                    className={cn("rounded-lg py-2 text-xs font-semibold transition-colors",
                                      adjustType === "admin_credit" ? "bg-yes text-white" : "bg-secondary text-muted-foreground hover:text-foreground")}>
                                    + Credit
                                  </button>
                                  <button onClick={() => setAdjustType("admin_debit")}
                                    className={cn("rounded-lg py-2 text-xs font-semibold transition-colors",
                                      adjustType === "admin_debit" ? "bg-no text-white" : "bg-secondary text-muted-foreground hover:text-foreground")}>
                                    - Debit
                                  </button>
                                </div>
                                <div className="relative">
                                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                                  <input type="number" min="0.01" step="0.01" value={adjustAmount}
                                    onChange={e => setAdjustAmount(e.target.value)} placeholder="Amount"
                                    className="w-full rounded border border-border bg-secondary pl-7 pr-3 py-2 text-sm text-foreground outline-none focus:border-brand/50"
                                  />
                                </div>
                                <input value={adjustDesc} onChange={e => setAdjustDesc(e.target.value)}
                                  placeholder="Description (optional)"
                                  className="w-full rounded border border-border bg-secondary px-3 py-2 text-sm text-foreground outline-none focus:border-brand/50"
                                />
                                {adjustError && <p className="text-xs text-destructive">{adjustError}</p>}
                                <div className="flex gap-2">
                                  <button onClick={() => { setAdjustingWallet(null); setAdjustAmount(""); setAdjustDesc(""); setAdjustError(""); }}
                                    className="flex-1 rounded-lg border border-border py-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
                                    Cancel
                                  </button>
                                  <button onClick={() => handleWalletAdjust(m._id)} disabled={adjusting}
                                    className={cn("flex-1 flex items-center justify-center gap-1 rounded-lg py-2 text-xs font-semibold text-white transition-colors disabled:opacity-60",
                                      adjustType === "admin_credit" ? "bg-yes hover:bg-yes/90" : "bg-no hover:bg-no/90")}>
                                    {adjusting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <DollarSign className="h-3.5 w-3.5" />}
                                    {adjusting ? "…" : "Apply"}
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex gap-2">
                                <button
                                  onClick={() => { setAdjustingWallet(m._id); setAdjustType("admin_credit"); setAdjustAmount(""); setAdjustDesc(""); setAdjustError(""); }}
                                  className="flex items-center gap-1.5 rounded-lg bg-yes/10 text-yes hover:bg-yes/20 px-3 py-2 text-xs font-semibold transition-colors">
                                  <ArrowUpCircle className="h-3.5 w-3.5" /> Adjust Balance
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))
            )}
          </tbody>
        </table>
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

const inputCls = "w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-all focus:border-brand/50 focus:ring-1 focus:ring-brand/20";
