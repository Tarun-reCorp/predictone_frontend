"use client";

import { useState, useEffect } from "react";
import { Wallet, Copy, ExternalLink, Loader2, Check, X } from "lucide-react";
import { useAdminWallet } from "@/hooks/use-admin-wallet";
import { cn } from "@/lib/utils";

export function AdminWalletConnect() {
  const { info, loading, reload } = useAdminWallet();
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/50 px-3 py-1.5">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Loading...</span>
      </div>
    );
  }

  if (!info?.configured) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-1.5">
        <X className="h-3.5 w-3.5 text-destructive" />
        <span className="text-xs font-medium text-destructive">Not Connected</span>
      </div>
    );
  }

  const shortenAddress = (addr: string) =>
    `${addr?.slice(0, 6)}...${addr?.slice(-4)}`;

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setMenuOpen(!menuOpen)}
        className={cn(
          "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all",
          info.configured
            ? "border-yes/30 bg-yes/10 hover:bg-yes/20 text-yes"
            : "border-border bg-secondary text-muted-foreground hover:text-foreground"
        )}
      >
        <Wallet className="h-3.5 w-3.5" />
        {info.address ? shortenAddress(info.address) : "Not Connected"}
        {menuOpen && <X className="h-3 w-3" />}
      </button>

      {menuOpen && info.configured && (
        <div className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-border bg-card shadow-xl overflow-hidden z-50">
          {/* Wallet Address Section */}
          <div className="border-b border-border/50 px-4 py-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">
              Trading Wallet
            </p>
            <div className="flex items-center justify-between gap-2">
              <code className="text-xs font-mono text-foreground flex-1 truncate">
                {info.address}
              </code>
              <button
                onClick={() => copyToClipboard(info.address || "")}
                className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors shrink-0"
                title="Copy address"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-yes" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
            {info.apiKeyConfigured && (
              <div className="mt-2 flex items-center gap-1.5 rounded bg-secondary/50 px-2.5 py-1.5">
                <div className="h-1.5 w-1.5 rounded-full bg-yes" />
                <span className="text-[10px] text-yes font-semibold">API Configured</span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="divide-y divide-border/50">
            <button
              onClick={async () => {
                await reload();
                setMenuOpen(false);
              }}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-foreground hover:bg-secondary transition-colors"
            >
              <Loader2 className="h-4 w-4" />
              Refresh Status
            </button>

            <a
              href={`https://polygonscan.com/address/${info.address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-brand hover:bg-secondary transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
              View on Polygonscan
            </a>

            <button
              onClick={() => {
                setMenuOpen(false);
                alert(
                  "To change the trading wallet, update POLY_PRIVATE_KEY in your .env file and restart the backend."
                );
              }}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-chart-4 hover:bg-secondary transition-colors"
            >
              <Wallet className="h-4 w-4" />
              Change Wallet
            </button>

            <button
              onClick={() => {
                setMenuOpen(false);
                alert(
                  "To disconnect the trading wallet, remove POLY_PRIVATE_KEY from your .env file and restart the backend."
                );
              }}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-destructive hover:bg-destructive/10 transition-colors"
            >
              <X className="h-4 w-4" />
              Disconnect Wallet
            </button>
          </div>

          {/* Info Footer */}
          <div className="bg-secondary/50 px-4 py-2.5 border-t border-border/50">
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              All orders will be executed through this wallet. It must have USDC balance on Polygon.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
