"use client";

import { useState } from "react";
import {
  Wallet,
  Copy,
  ExternalLink,
  Check,
  X,
  Unplug,
  RefreshCw,
  ArrowLeftRight,
} from "lucide-react";
import { useWalletContext } from "@/contexts/wallet-context";
import { getChainName } from "@/lib/wallet";
import { cn } from "@/lib/utils";

export function AdminWalletConnect() {
  const {
    isConnected,
    address,
    chainId,
    balance,
    loading,
    connect,
    disconnect,
    changeWallet,
    refreshBalance,
  } = useWalletContext();

  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const shortenAddr = (addr: string) =>
    `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  const copyAddress = async () => {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const explorerUrl = chainId === 137
    ? `https://polygonscan.com/address/${address}`
    : chainId === 1
    ? `https://etherscan.io/address/${address}`
    : chainId === 56
    ? `https://bscscan.com/address/${address}`
    : chainId === 42161
    ? `https://arbiscan.io/address/${address}`
    : `https://polygonscan.com/address/${address}`;

  // Not connected state
  if (!isConnected) {
    return (
      <button
        onClick={connect}
        className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-1.5 hover:bg-destructive/10 transition-colors"
      >
        <X className="h-3.5 w-3.5 text-destructive" />
        <span className="text-xs font-medium text-destructive">Wallet Disconnected</span>
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setMenuOpen(!menuOpen)}
        className="flex items-center gap-2 rounded-lg border border-yes/30 bg-yes/10 hover:bg-yes/20 px-3 py-1.5 text-xs font-medium text-yes transition-all"
      >
        <Wallet className="h-3.5 w-3.5" />
        {address ? shortenAddr(address) : "Connected"}
      </button>

      {menuOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setMenuOpen(false)}
          />

          <div className="absolute right-0 top-full mt-2 w-64 rounded-xl border border-border bg-card shadow-xl overflow-hidden z-50">
            {/* Wallet Info */}
            <div className="border-b border-border/50 px-4 py-3">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  Connected Wallet
                </p>
                <span className="flex items-center gap-1 rounded-full bg-yes/10 px-2 py-0.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-yes animate-pulse" />
                  <span className="text-[10px] font-semibold text-yes">
                    {chainId ? getChainName(chainId) : "Connected"}
                  </span>
                </span>
              </div>

              <div className="flex items-center justify-between gap-2">
                <code className="text-xs font-mono text-foreground flex-1 truncate">
                  {address}
                </code>
                <button
                  onClick={copyAddress}
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

              {balance !== null && (
                <div className="mt-2 flex items-center gap-1.5 rounded bg-secondary/50 px-2.5 py-1.5">
                  <span className="text-[10px] text-muted-foreground">Balance:</span>
                  <span className="text-[10px] font-mono font-semibold text-foreground">
                    {parseFloat(balance).toFixed(4)} {chainId === 137 ? "POL" : "ETH"}
                  </span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="divide-y divide-border/50">
              <button
                onClick={async () => {
                  await refreshBalance();
                }}
                disabled={loading}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-foreground hover:bg-secondary transition-colors disabled:opacity-50"
              >
                <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                Refresh Balance
              </button>

              <a
                href={explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setMenuOpen(false)}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-brand hover:bg-secondary transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
                View on Explorer
              </a>

              <button
                onClick={() => {
                  setMenuOpen(false);
                  changeWallet();
                }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-chart-4 hover:bg-secondary transition-colors"
              >
                <ArrowLeftRight className="h-4 w-4" />
                Change Wallet
              </button>

              <button
                onClick={async () => {
                  setMenuOpen(false);
                  await disconnect();
                }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-destructive hover:bg-destructive/10 transition-colors"
              >
                <Unplug className="h-4 w-4" />
                Disconnect Wallet
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
