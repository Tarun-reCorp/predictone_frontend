"use client";

import { useState } from "react";
import {
  Wallet,
  Copy,
  Check,
  ExternalLink,
  Unplug,
  RefreshCw,
  ArrowLeftRight,
  Shield,
  Link2,
  Link2Off,
  Globe,
} from "lucide-react";
import { useWalletContext } from "@/contexts/wallet-context";
import { getChainName, CHAIN_COLORS } from "@/lib/wallet";
import { cn } from "@/lib/utils";

export default function AdminWalletPage() {
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

  const [copied, setCopied] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const copyAddress = async () => {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    await disconnect();
    setDisconnecting(false);
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

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Wallet Management</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Connect and manage your admin wallet for blockchain operations.
        </p>
      </div>

      {/* Connection Status Card */}
      <div className={cn(
        "rounded-xl border p-6 transition-all",
        isConnected
          ? "border-yes/20 bg-yes/5"
          : "border-border bg-card"
      )}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              "flex h-12 w-12 items-center justify-center rounded-xl",
              isConnected ? "bg-yes/15" : "bg-secondary"
            )}>
              {isConnected ? (
                <Link2 className="h-6 w-6 text-yes" />
              ) : (
                <Link2Off className="h-6 w-6 text-muted-foreground" />
              )}
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                {isConnected ? "Wallet Connected" : "No Wallet Connected"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isConnected
                  ? "Your wallet is active and ready for operations."
                  : "Connect a wallet to get started."}
              </p>
            </div>
          </div>

          {isConnected ? (
            <span className="flex items-center gap-1.5 rounded-full border border-yes/30 bg-yes/10 px-3 py-1">
              <span className="h-2 w-2 rounded-full bg-yes animate-pulse" />
              <span className="text-xs font-semibold text-yes">Active</span>
            </span>
          ) : (
            <button
              onClick={connect}
              className="flex items-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand/90 transition-colors"
            >
              <Wallet className="h-4 w-4" />
              Connect Wallet
            </button>
          )}
        </div>
      </div>

      {/* Wallet Details — only when connected */}
      {isConnected && address && (
        <>
          {/* Address & Network Card */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="border-b border-border px-6 py-4">
              <h2 className="text-sm font-semibold text-foreground">Wallet Details</h2>
            </div>

            <div className="divide-y divide-border">
              {/* Address Row */}
              <div className="flex items-center justify-between px-6 py-4">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary shrink-0">
                    <Wallet className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground">Address</p>
                    <p className="text-sm font-mono text-foreground truncate">{address}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0 ml-3">
                  <button
                    onClick={copyAddress}
                    className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-secondary transition-colors"
                    title="Copy address"
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-yes" />
                    ) : (
                      <Copy className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                  <a
                    href={explorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-secondary transition-colors"
                    title="View on Explorer"
                  >
                    <ExternalLink className="h-4 w-4 text-brand" />
                  </a>
                </div>
              </div>

              {/* Network Row */}
              <div className="flex items-center justify-between px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary shrink-0">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Network</p>
                    <p className={cn(
                      "text-sm font-semibold",
                      chainId && CHAIN_COLORS[chainId] ? CHAIN_COLORS[chainId] : "text-foreground"
                    )}>
                      {chainId ? getChainName(chainId) : "Unknown"}
                    </p>
                  </div>
                </div>
                <span className="rounded-md bg-secondary px-2.5 py-1 text-xs font-mono text-muted-foreground">
                  Chain ID: {chainId}
                </span>
              </div>

              {/* Balance Row */}
              <div className="flex items-center justify-between px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary shrink-0">
                    <Shield className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Native Balance</p>
                    <p className="text-sm font-semibold text-foreground">
                      {balance !== null
                        ? `${parseFloat(balance).toFixed(6)} ${chainId === 137 ? "POL" : chainId === 56 ? "BNB" : "ETH"}`
                        : "Loading..."}
                    </p>
                  </div>
                </div>
                <button
                  onClick={refreshBalance}
                  disabled={loading}
                  className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
                  Refresh
                </button>
              </div>
            </div>
          </div>

          {/* Actions Card */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="border-b border-border px-6 py-4">
              <h2 className="text-sm font-semibold text-foreground">Actions</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-border">
              {/* Change Wallet */}
              <button
                onClick={changeWallet}
                className="flex flex-col items-center gap-2 px-6 py-6 hover:bg-secondary/50 transition-colors group"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-chart-4/10 group-hover:bg-chart-4/20 transition-colors">
                  <ArrowLeftRight className="h-5 w-5 text-chart-4" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-foreground">Change Wallet</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Switch to a different wallet</p>
                </div>
              </button>

              {/* View on Explorer */}
              <a
                href={explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center gap-2 px-6 py-6 hover:bg-secondary/50 transition-colors group"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 group-hover:bg-brand/20 transition-colors">
                  <ExternalLink className="h-5 w-5 text-brand" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-foreground">View on Explorer</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Open in block explorer</p>
                </div>
              </a>

              {/* Disconnect */}
              <button
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="flex flex-col items-center gap-2 px-6 py-6 hover:bg-destructive/5 transition-colors group disabled:opacity-50"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/10 group-hover:bg-destructive/20 transition-colors">
                  <Unplug className={cn("h-5 w-5 text-destructive", disconnecting && "animate-pulse")} />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-destructive">Disconnect</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {disconnecting ? "Disconnecting..." : "Remove wallet session"}
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Info Banner */}
          <div className="rounded-xl border border-border bg-secondary/30 px-6 py-4">
            <div className="flex items-start gap-3">
              <Shield className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-foreground">Security Note</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Your private keys never leave your wallet. PredictOne only requests
                  signature permissions needed for order execution. You can disconnect
                  at any time to revoke access.
                </p>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Not Connected — Prompt */}
      {!isConnected && (
        <div className="rounded-xl border border-dashed border-border bg-card/50 px-6 py-12 text-center">
          <div className="flex justify-center mb-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary">
              <Wallet className="h-8 w-8 text-muted-foreground" />
            </div>
          </div>
          <h3 className="text-lg font-semibold text-foreground">Connect Your Wallet</h3>
          <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
            Connect with MetaMask, Trust Wallet, or any WalletConnect-compatible wallet
            to manage blockchain operations from the admin panel.
          </p>
          <button
            onClick={connect}
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-brand px-6 py-3 text-sm font-semibold text-white hover:bg-brand/90 transition-colors"
          >
            <Wallet className="h-4 w-4" />
            Connect Wallet
          </button>

          <div className="mt-8 flex justify-center gap-8">
            {[
              { name: "MetaMask", icon: "🦊" },
              { name: "Trust Wallet", icon: "🛡️" },
              { name: "WalletConnect", icon: "🔗" },
            ].map((w) => (
              <div key={w.name} className="flex flex-col items-center gap-1.5">
                <span className="text-2xl">{w.icon}</span>
                <span className="text-[11px] text-muted-foreground">{w.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
