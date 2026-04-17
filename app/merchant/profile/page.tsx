"use client";

import { useState } from "react";
import {
  User, Mail, Shield, CircleDot, Clock, TrendingUp,
  Wallet, Receipt, Pencil, Check, X, Loader2, Save,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export default function MerchantProfilePage() {
  const { user, token, updateUser } = useAuth();

  const [editing, setEditing]   = useState(false);
  const [name, setName]         = useState(user?.name ?? "");
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState("");
  const [success, setSuccess]   = useState("");

  if (!user) return null;

  const joinedDate = new Date(user.createdAt).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) { setError("Name cannot be empty"); return; }
    if (trimmed === user.name) { setEditing(false); return; }

    setError(""); setSuccess(""); setSaving(true);
    try {
      const res = await fetch(`${API}/api/merchant/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Failed to update");
      updateUser({ ...user, name: trimmed });
      setSuccess("Profile updated successfully");
      setEditing(false);
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally { setSaving(false); }
  };

  const handleCancel = () => {
    setName(user.name);
    setEditing(false);
    setError("");
  };

  return (
    <div className="flex flex-col gap-6 max-w-2xl">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Profile</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          View and manage your account information.
        </p>
      </div>

      {/* Alerts */}
      {success && (
        <div className="rounded-lg bg-yes/10 border border-yes/20 px-4 py-2.5 text-sm text-yes flex items-center gap-2">
          <Check className="h-4 w-4" /> {success}
        </div>
      )}
      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-2.5 text-sm text-destructive flex items-center gap-2">
          <X className="h-4 w-4" /> {error}
        </div>
      )}

      {/* Avatar + Name card */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand text-primary-foreground text-xl font-bold shrink-0">
            {user.name.split(" ").slice(0, 2).map(w => w[0].toUpperCase()).join("")}
          </div>
          <div className="flex-1 min-w-0">
            {editing ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="flex-1 rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20"
                  autoFocus
                  onKeyDown={e => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") handleCancel(); }}
                />
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex h-9 w-9 items-center justify-center rounded-lg bg-yes/15 hover:bg-yes/25 text-yes transition-colors disabled:opacity-50"
                  title="Save"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                </button>
                <button
                  onClick={handleCancel}
                  className="flex h-9 w-9 items-center justify-center rounded-lg bg-destructive/10 hover:bg-destructive/20 text-destructive transition-colors"
                  title="Cancel"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-foreground">{user.name}</h2>
                <button
                  onClick={() => { setName(user.name); setEditing(true); setError(""); }}
                  className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                  title="Edit name"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            <p className="text-sm text-muted-foreground mt-0.5">{user.email}</p>
          </div>
        </div>
      </div>

      {/* Account Details */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">Account Information</h2>
        </div>
        <div className="divide-y divide-border">
          <DetailRow icon={Mail}       label="Email"            value={user.email} />
          <DetailRow icon={Shield}     label="Role"             value={user.role} capitalize />
          <DetailRow
            icon={CircleDot}
            label="Account Status"
            value={user.status}
            capitalize
            highlight={user.status === "active"}
          />
          <DetailRow icon={Clock}      label="Member Since"     value={joinedDate} />
          <DetailRow icon={TrendingUp} label="Account ID"       value={user._id} mono />
        </div>
      </div>

      {/* Financial Summary */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">Financial Summary</h2>
        </div>
        <div className="divide-y divide-border">
          <DetailRow
            icon={Wallet}
            label="Wallet Balance"
            value={`$${user.walletBalance.toFixed(2)}`}
            highlight
          />
          <DetailRow
            icon={Receipt}
            label="Total Commission Paid"
            value={`$${user.totalCommissionPaid.toFixed(2)}`}
          />
        </div>
      </div>

    </div>
  );
}

function DetailRow({ icon: Icon, label, value, mono = false, capitalize = false, highlight = false }: {
  icon: React.ElementType; label: string; value: string; mono?: boolean; capitalize?: boolean; highlight?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 px-5 py-3.5">
      <div className={cn(
        "flex h-8 w-8 items-center justify-center rounded-lg shrink-0",
        highlight ? "bg-yes/15" : "bg-secondary"
      )}>
        <Icon className={cn("h-4 w-4", highlight ? "text-yes" : "text-muted-foreground")} />
      </div>
      <span className="text-sm text-muted-foreground w-44 shrink-0">{label}</span>
      <span className={cn(
        "text-sm flex-1 truncate",
        mono ? "font-mono text-xs text-foreground" : "",
        capitalize ? "capitalize" : "",
        highlight ? "text-yes font-semibold" : "text-foreground",
      )}>
        {value}
      </span>
    </div>
  );
}
