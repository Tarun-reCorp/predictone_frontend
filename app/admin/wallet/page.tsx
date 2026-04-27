"use client";

import { useEffect, useState } from "react";
import { QrCode, CreditCard, Bitcoin, FileText, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const MODES = [
  { key: "upi",    label: "UPI",    icon: QrCode,      color: "text-amber-400",   bg: "bg-amber-400/10",   border: "border-amber-400/20"  },
  { key: "card",   label: "Card",   icon: CreditCard,  color: "text-brand",       bg: "bg-brand/10",       border: "border-brand/20"      },
  { key: "crypto", label: "Crypto", icon: Bitcoin,     color: "text-emerald-400", bg: "bg-emerald-400/10", border: "border-emerald-400/20" },
  { key: "manual", label: "Manual", icon: FileText,    color: "text-slate-400",   bg: "bg-slate-400/10",   border: "border-slate-400/20"  },
];

export default function AdminWalletPage() {
  const { token } = useAuth();
  const [stats, setStats]     = useState<{ mode: string; count: number; volume: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    fetch(`${API}/api/admin/payment-mode-stats`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => setStats(d.data?.stats ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  const getStat = (mode: string) =>
    stats.find(s => s.mode === mode) ?? { count: 0, volume: 0 };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Payment Modes</h1>
        <p className="text-sm text-muted-foreground mt-1">Successful payments by method.</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {MODES.map(m => {
            const { count, volume } = getStat(m.key);
            return (
              <div key={m.key}
                className={cn("rounded-2xl border bg-card p-6 flex flex-col items-center gap-3", m.border)}>
                <div className={cn("flex h-14 w-14 items-center justify-center rounded-2xl", m.bg)}>
                  <m.icon className={cn("h-7 w-7", m.color)} />
                </div>
                <p className="text-sm font-semibold text-muted-foreground">{m.label}</p>
                <div className="text-center">
                  <p className={cn("text-4xl font-bold font-mono leading-none", m.color)}>
                    {count.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">successful</p>
                </div>
                <div className={cn("w-full rounded-lg border px-3 py-2 text-center", m.bg, m.border)}>
                  <p className="text-[10px] text-muted-foreground">Total Volume</p>
                  <p className={cn("text-base font-bold font-mono mt-0.5", m.color)}>
                    ₹{volume.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
