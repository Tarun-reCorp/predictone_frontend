"use client";

import { useState } from "react";
import {
  Store, User, Mail, Shield, CircleDot, TrendingUp, Clock,
  Wallet, CheckCircle2, Loader2, AlertCircle, Copy, Unplug, ExternalLink,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useWallet } from "@/hooks/use-wallet";
import { shortenAddress, getChainName } from "@/lib/wallet";
import { cn } from "@/lib/utils";

export default function MerchantDashboardPage() {
  const { user } = useAuth();
  const wallet   = useWallet();
  const [copied, setCopied] = useState(false);

  if (!user) return null;

  const joinedDate = new Date(user.createdAt).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });

  const stats = [
    { label: "Account Status", value: user.status, icon: CircleDot, highlight: user.status === "active" },
    { label: "Role",           value: user.role,   icon: Shield,    highlight: false },
    { label: "Member Since",   value: joinedDate,  icon: Clock,     highlight: false },
  ];

  const handleCopy = async () => {
    await wallet.copyAddress();
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      {/* Welcome banner */}
      <div className="rounded-2xl border border-border bg-card p-6 flex items-start gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/20 shrink-0">
          <Store className="h-7 w-7 text-brand" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Welcome back, {user.name.split(" ")[0]}!
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your profile and track your account activity.
          </p>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
            <div className={cn(
              "flex h-9 w-9 items-center justify-center rounded-lg shrink-0",
              s.highlight ? "bg-yes/15" : "bg-secondary"
            )}>
              <s.icon className={cn("h-4 w-4", s.highlight ? "text-yes" : "text-muted-foreground")} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className={cn("text-sm font-semibold capitalize mt-0.5", s.highlight ? "text-yes" : "text-foreground")}>
                {s.value}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Wallet card */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">Wallet</h2>
          </div>
          {wallet.address && (
            <span className="text-[10px] font-medium rounded-full bg-yes/15 text-yes px-2 py-0.5">
              Connected
            </span>
          )}
        </div>

        <div className="p-5">
          {wallet.address ? (
            /* ── Connected state ── */
            <div className="space-y-4">
              {/* Address + network row */}
              <div className="flex items-start gap-4 p-4 rounded-xl bg-yes/5 border border-yes/15">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yes/15 shrink-0">
                  <CheckCircle2 className="h-5 w-5 text-yes" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground mb-0.5">Wallet address</p>
                  <p className="text-sm font-mono text-foreground break-all leading-relaxed">
                    {wallet.address}
                  </p>
                  {wallet.chainId && (
                    <span className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <span className="h-1.5 w-1.5 rounded-full bg-yes inline-block" />
                      {getChainName(wallet.chainId)}
                    </span>
                  )}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 rounded-lg border border-border bg-secondary hover:bg-secondary/80 px-3 py-1.5 text-xs font-medium text-foreground transition-colors"
                >
                  <Copy className="h-3.5 w-3.5" />
                  {copied ? "Copied!" : "Copy Address"}
                </button>
                <a
                  href={`https://polygonscan.com/address/${wallet.address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded-lg border border-border bg-secondary hover:bg-secondary/80 px-3 py-1.5 text-xs font-medium text-foreground transition-colors"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  View on Explorer
                </a>
                <button
                  onClick={wallet.disconnect}
                  disabled={wallet.isDisconnecting}
                  className="flex items-center gap-1.5 rounded-lg border border-destructive/30 bg-destructive/10 hover:bg-destructive/20 px-3 py-1.5 text-xs font-medium text-destructive transition-colors disabled:opacity-60 ml-auto"
                >
                  {wallet.isDisconnecting
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Unplug className="h-3.5 w-3.5" />
                  }
                  Disconnect
                </button>
              </div>
            </div>
          ) : (
            /* ── Not connected state ── */
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">No wallet connected</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Connect your MetaMask wallet to enable trading and transaction features.
                  </p>
                </div>
                <button
                  onClick={wallet.connect}
                  disabled={wallet.isConnecting}
                  className="flex shrink-0 items-center justify-center gap-2 rounded-lg bg-brand hover:bg-brand/90 disabled:opacity-60 text-primary-foreground font-semibold px-5 h-9 text-sm transition-colors"
                >
                  {wallet.isConnecting
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Connecting…</>
                    : <><Wallet className="h-4 w-4" /> Connect Wallet</>
                  }
                </button>
              </div>

              {/* MetaMask not installed */}
              {!wallet.isInstalled && (
                <div className="flex items-center justify-between rounded-lg bg-secondary border border-border px-4 py-3">
                  <p className="text-xs text-muted-foreground">MetaMask extension not detected</p>
                  <a
                    href="https://metamask.io/download/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-brand font-medium hover:underline"
                  >
                    Install MetaMask <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}

              {/* Error */}
              {wallet.error && (
                <div className="flex items-start gap-2 rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3">
                  <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  <p className="text-xs text-destructive">{wallet.error}</p>
                </div>
              )}
            </div>
          )}

          {/* Disconnect error */}
          {wallet.error && wallet.address && (
            <div className="mt-3 flex items-start gap-2 rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3">
              <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-xs text-destructive">{wallet.error}</p>
            </div>
          )}
        </div>
      </div>

      {/* Account details */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">Account Details</h2>
        </div>
        <div className="divide-y divide-border">
          <DetailRow icon={User}       label="Full Name"     value={user.name} />
          <DetailRow icon={Mail}       label="Email"         value={user.email} />
          <DetailRow
            icon={Wallet}
            label="Wallet"
            value={wallet.address ? shortenAddress(wallet.address, 6) : "Not connected"}
            dim={!wallet.address}
            mono={!!wallet.address}
          />
          <DetailRow icon={TrendingUp} label="Account ID"   value={user._id} mono />
        </div>
      </div>
    </div>
  );
}

function DetailRow({
  icon: Icon, label, value, dim = false, mono = false,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  dim?: boolean;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 px-5 py-3.5">
      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
      <span className="text-sm text-muted-foreground w-36 shrink-0">{label}</span>
      <span className={cn(
        "text-sm flex-1 truncate",
        dim  ? "text-muted-foreground italic" : "text-foreground",
        mono ? "font-mono text-xs" : ""
      )}>
        {value}
      </span>
    </div>
  );
}
