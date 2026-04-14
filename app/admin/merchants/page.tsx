"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Search, Loader2, UserCheck, UserX, X, Eye, EyeOff } from "lucide-react";
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
  createdAt: string;
}

export default function MerchantsPage() {
  const { token } = useAuth();
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [total, setTotal] = useState(0);
  const [fetching, setFetching] = useState(true);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  // Create form state
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [showPw, setShowPw] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const fetchMerchants = useCallback(async () => {
    if (!token) return;
    setFetching(true);
    try {
      const res = await fetch(`${API}/api/admin/merchants?limit=50`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      setMerchants(json.data ?? []);
      setTotal(json.meta?.total ?? 0);
    } catch {
      // silent
    } finally {
      setFetching(false);
    }
  }, [token]);

  useEffect(() => { fetchMerchants(); }, [fetchMerchants]);

  const toggleStatus = async (id: string, current: "active" | "blocked") => {
    const next = current === "active" ? "blocked" : "active";
    await fetch(`${API}/api/admin/merchants/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status: next }),
    });
    setMerchants((prev) =>
      prev.map((m) => (m._id === id ? { ...m, status: next } : m))
    );
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError("");
    setCreating(true);
    try {
      const res = await fetch(`${API}/api/admin/merchants`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Failed to create merchant");
      setShowCreate(false);
      setForm({ name: "", email: "", password: "" });
      fetchMerchants();
    } catch (e: unknown) {
      setCreateError(e instanceof Error ? e.message : "Failed to create merchant");
    } finally {
      setCreating(false);
    }
  };

  const filtered = merchants.filter(
    (m) =>
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Merchants</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{total} total accounts</p>
        </div>
        <Button
          onClick={() => { setShowCreate(true); setCreateError(""); }}
          className="bg-brand hover:bg-brand/90 text-primary-foreground font-semibold flex items-center gap-1.5"
        >
          <Plus className="h-4 w-4" />
          Create Merchant
        </Button>
      </div>

      {/* Create merchant modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <h2 className="text-base font-bold text-foreground">Create New Merchant</h2>
              <button onClick={() => setShowCreate(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-6 flex flex-col gap-4">
              {createError && (
                <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-2.5 text-sm text-destructive">
                  {createError}
                </div>
              )}
              <Field label="Full Name">
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="John Doe"
                  required
                  className={inputCls}
                />
              </Field>
              <Field label="Email">
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="merchant@example.com"
                  required
                  className={inputCls}
                />
              </Field>
              <Field label="Password">
                <div className="relative">
                  <input
                    type={showPw ? "text" : "password"}
                    value={form.password}
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                    placeholder="Min 8 chars, upper, lower, digit"
                    required
                    className={cn(inputCls, "pr-10")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </Field>
              <div className="flex gap-3 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 border-border"
                  onClick={() => setShowCreate(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-brand hover:bg-brand/90 text-primary-foreground font-semibold"
                  disabled={creating}
                >
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
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search merchants..."
          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
        />
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/50">
              <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Name</th>
              <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Email</th>
              <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Status</th>
              <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Joined</th>
              <th className="px-4 py-3 text-right font-semibold text-muted-foreground">Action</th>
            </tr>
          </thead>
          <tbody>
            {fetching ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground text-sm">
                  No merchants found
                </td>
              </tr>
            ) : (
              filtered.map((m) => (
                <tr key={m._id} className="border-b border-border last:border-0 hover:bg-secondary/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand/20 text-brand text-[10px] font-bold shrink-0">
                        {m.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                      </div>
                      <span className="font-medium text-foreground">{m.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{m.email}</td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold",
                      m.status === "active"
                        ? "bg-yes/15 text-yes"
                        : "bg-no/15 text-no"
                    )}>
                      {m.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(m.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => toggleStatus(m._id, m.status)}
                      className={cn(
                        "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ml-auto",
                        m.status === "active"
                          ? "bg-no/10 text-no hover:bg-no/20"
                          : "bg-yes/10 text-yes hover:bg-yes/20"
                      )}
                    >
                      {m.status === "active" ? (
                        <><UserX className="h-3.5 w-3.5" /> Block</>
                      ) : (
                        <><UserCheck className="h-3.5 w-3.5" /> Unblock</>
                      )}
                    </button>
                  </td>
                </tr>
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

const inputCls =
  "w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-all focus:border-brand/50 focus:ring-1 focus:ring-brand/20";
