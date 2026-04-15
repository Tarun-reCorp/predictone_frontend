"use client";

import { useState, useEffect } from "react";
import { Receipt, Edit2, Check, X, ChevronLeft, ChevronRight, Loader2, ToggleLeft, ToggleRight } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface CommissionRule {
  _id: string;
  userId: { _id: string; name: string; email: string };
  threshold: number;
  flatAmount: number;
  percentageRate: number;
  isActive: boolean;
  notes?: string;
  updatedAt: string;
}

export default function CommissionPage() {
  const { token } = useAuth();
  const [rules, setRules]       = useState<CommissionRule[]>([]);
  const [loading, setLoading]   = useState(true);
  const [page, setPage]         = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal]       = useState(0);
  const [editId, setEditId]     = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<CommissionRule>>({});
  const [saving, setSaving]     = useState(false);
  const [saveError, setSaveError] = useState("");

  const load = () => {
    if (!token) return;
    setLoading(true);
    fetch(`${API}/api/admin/commission?page=${page}&limit=15`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { setRules(d.data ?? []); setTotalPages(d.meta?.totalPages ?? 1); setTotal(d.meta?.total ?? 0); })
      .catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(load, [token, page]);

  const startEdit = (rule: CommissionRule) => {
    setEditId(rule._id);
    setEditData({ threshold: rule.threshold, flatAmount: rule.flatAmount, percentageRate: rule.percentageRate, isActive: rule.isActive, notes: rule.notes });
    setSaveError("");
  };

  const cancelEdit = () => { setEditId(null); setEditData({}); setSaveError(""); };

  const saveEdit = async (rule: CommissionRule) => {
    setSaving(true); setSaveError("");
    try {
      const res = await fetch(`${API}/api/admin/merchants/${rule.userId._id}/commission`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(editData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Failed");
      setEditId(null); load();
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : "Save failed");
    } finally { setSaving(false); }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Commission Rules</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {total} merchant{total !== 1 ? "s" : ""} · Configure flat/percentage commission per merchant
        </p>
      </div>

      {/* Info card */}
      <div className="rounded-xl border border-brand/20 bg-brand/5 px-5 py-4">
        <p className="text-sm font-medium text-foreground mb-1">How commission works</p>
        <p className="text-xs text-muted-foreground">
          If order amount is <strong>below threshold</strong> → charge flat fee.
          If order amount is <strong>at or above threshold</strong> → charge percentage fee.
          Example: threshold=$100, flat=$1, rate=2% →  $80 order = $1 commission, $150 order = $3 commission.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <p className="text-sm font-semibold text-foreground">Commission Rules</p>
          <span className="text-xs text-muted-foreground">Set rules when creating or editing a merchant</span>
        </div>
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : rules.length === 0 ? (
          <div className="flex flex-col items-center py-16 gap-2 text-center">
            <Receipt className="h-9 w-9 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No commission rules set</p>
            <p className="text-xs text-muted-foreground/60">Rules are created when you create a merchant or use the Merchants page</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/30">
                    {["Merchant", "Threshold", "Flat Fee", "% Rate", "Status", "Updated", "Actions"].map(h => (
                      <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {rules.map(rule => {
                    const isEditing = editId === rule._id;
                    return (
                      <tr key={rule._id} className="hover:bg-secondary/20 transition-colors">
                        <td className="px-5 py-4">
                          <p className="font-medium text-foreground">{rule.userId?.name ?? "—"}</p>
                          <p className="text-xs text-muted-foreground">{rule.userId?.email ?? ""}</p>
                        </td>
                        <td className="px-5 py-4">
                          {isEditing ? (
                            <input type="number" min="0" step="1" value={editData.threshold ?? rule.threshold}
                              onChange={e => setEditData(d => ({ ...d, threshold: parseFloat(e.target.value) }))}
                              className="w-24 rounded border border-border bg-secondary px-2 py-1 text-sm text-foreground outline-none focus:border-brand/50"
                            />
                          ) : <span className="font-mono">${rule.threshold}</span>}
                        </td>
                        <td className="px-5 py-4">
                          {isEditing ? (
                            <input type="number" min="0" step="0.01" value={editData.flatAmount ?? rule.flatAmount}
                              onChange={e => setEditData(d => ({ ...d, flatAmount: parseFloat(e.target.value) }))}
                              className="w-20 rounded border border-border bg-secondary px-2 py-1 text-sm text-foreground outline-none focus:border-brand/50"
                            />
                          ) : <span className="font-mono text-chart-4">${rule.flatAmount}</span>}
                        </td>
                        <td className="px-5 py-4">
                          {isEditing ? (
                            <input type="number" min="0" max="100" step="0.1" value={editData.percentageRate ?? rule.percentageRate}
                              onChange={e => setEditData(d => ({ ...d, percentageRate: parseFloat(e.target.value) }))}
                              className="w-20 rounded border border-border bg-secondary px-2 py-1 text-sm text-foreground outline-none focus:border-brand/50"
                            />
                          ) : <span className="font-mono text-brand">{rule.percentageRate}%</span>}
                        </td>
                        <td className="px-5 py-4">
                          {isEditing ? (
                            <button onClick={() => setEditData(d => ({ ...d, isActive: !d.isActive }))}
                              className={cn("flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors",
                                editData.isActive ? "bg-yes/15 text-yes" : "bg-muted text-muted-foreground")}>
                              {editData.isActive ? <ToggleRight className="h-3.5 w-3.5" /> : <ToggleLeft className="h-3.5 w-3.5" />}
                              {editData.isActive ? "Active" : "Inactive"}
                            </button>
                          ) : (
                            <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
                              rule.isActive ? "bg-yes/15 text-yes" : "bg-secondary text-muted-foreground")}>
                              {rule.isActive ? "Active" : "Inactive"}
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-xs text-muted-foreground">
                          {new Date(rule.updatedAt).toLocaleDateString()}
                        </td>
                        <td className="px-5 py-4">
                          {isEditing ? (
                            <div className="flex items-center gap-1">
                              {saveError && <span className="text-xs text-destructive mr-2">{saveError}</span>}
                              <button onClick={() => saveEdit(rule)} disabled={saving}
                                className="flex items-center gap-1 rounded-lg bg-yes/10 text-yes hover:bg-yes/20 px-2.5 py-1.5 text-xs font-semibold disabled:opacity-60">
                                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Save
                              </button>
                              <button onClick={cancelEdit}
                                className="flex items-center gap-1 rounded-lg bg-secondary text-muted-foreground hover:text-foreground px-2.5 py-1.5 text-xs font-semibold">
                                <X className="h-3.5 w-3.5" /> Cancel
                              </button>
                            </div>
                          ) : (
                            <button onClick={() => startEdit(rule)}
                              className="flex items-center gap-1 rounded-lg bg-brand/10 text-brand hover:bg-brand/20 px-2.5 py-1.5 text-xs font-semibold">
                              <Edit2 className="h-3.5 w-3.5" /> Edit
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-secondary/10">
                <span className="text-sm text-muted-foreground">Page <b>{page}</b> of <b>{totalPages}</b></span>
                <div className="flex gap-2">
                  <button onClick={() => setPage(p => p - 1)} disabled={page <= 1}
                    className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors">
                    <ChevronLeft className="h-4 w-4" /> Prev
                  </button>
                  <button onClick={() => setPage(p => p + 1)} disabled={page >= totalPages}
                    className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors">
                    Next <ChevronRight className="h-4 w-4" />
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
