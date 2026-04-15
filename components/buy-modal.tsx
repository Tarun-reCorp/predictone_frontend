"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  TrendingUp, TrendingDown, Loader2, CheckCircle2,
  AlertCircle, Wallet, LogIn, ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useOrder, type PlacedOrder } from "@/hooks/use-order";

interface BuyModalProps {
  open: boolean;
  onClose: () => void;
  outcome: "Yes" | "No" | null;
  price: number;           // 0–1  (e.g. 0.65 = 65¢)
  conditionId: string;
  marketQuestion: string;
  initialAmount?: number;         // pre-fill amount from trade panel
  onLoginRequired: () => void;    // open auth modal
  onWalletRequired: () => void;   // open wallet connect
}

const MIN_AMOUNT = 1;   // $1 USDC minimum
const MAX_AMOUNT = 10_000;

export function BuyModal({
  open,
  onClose,
  outcome,
  price,
  conditionId,
  marketQuestion,
  initialAmount,
  onLoginRequired,
  onWalletRequired,
}: BuyModalProps) {
  const { placeOrder, isPlacing, error, clearError, isLoggedIn, hasWallet } = useOrder();

  const [amount, setAmount]             = useState(initialAmount ? String(initialAmount) : "");
  const [successOrder, setSuccessOrder] = useState<PlacedOrder | null>(null);

  const isYes       = outcome === "Yes";
  const pricePct    = Math.round(price * 100);
  const numAmount   = parseFloat(amount) || 0;
  const estimShares = numAmount > 0 && price > 0 ? (numAmount / price).toFixed(2) : "—";
  const isValid     = numAmount >= MIN_AMOUNT && numAmount <= MAX_AMOUNT;

  // Reset / pre-fill state when modal opens/closes
  useEffect(() => {
    if (open) {
      setAmount(initialAmount && initialAmount > 0 ? String(initialAmount) : "");
      setSuccessOrder(null);
      clearError();
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async () => {
    if (!isLoggedIn) { onClose(); onLoginRequired(); return; }
    // Wallet connect no longer required — orders execute via platform wallet
    if (!isValid || !outcome) return;

    try {
      const order = await placeOrder({ conditionId, outcome, amount: numAmount, price, marketQuestion });
      setSuccessOrder(order);
    } catch {
      // error shown via useOrder().error
    }
  };

  const PRESETS = [5, 10, 25, 50];

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm p-0 overflow-hidden border border-border bg-card">
        {/* ── Header ── */}
        <DialogHeader className={cn(
          "px-5 py-4 border-b border-border/50",
          isYes ? "bg-yes/5" : "bg-no/5"
        )}>
          <DialogTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
            {isYes
              ? <TrendingUp className="h-4 w-4 text-yes" />
              : <TrendingDown className="h-4 w-4 text-no" />}
            Buy {outcome}
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
            {marketQuestion}
          </p>
        </DialogHeader>

        <div className="p-5 space-y-4">

          {/* ── Success state ── */}
          {successOrder ? (
            <div className="space-y-4">
              <div className="flex flex-col items-center gap-3 py-4 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-yes/15">
                  <CheckCircle2 className="h-6 w-6 text-yes" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Order Placed!</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Your {successOrder.outcome} order has been submitted.
                  </p>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-secondary/50 divide-y divide-border/50 text-xs">
                {[
                  { label: "Outcome",  value: successOrder.outcome, color: isYes ? "text-yes" : "text-no" },
                  { label: "Amount",   value: `$${successOrder.amount.toFixed(2)}` },
                  { label: "Price",    value: `${Math.round(successOrder.price * 100)}¢` },
                  { label: "Shares",   value: successOrder.size.toFixed(2) },
                  { label: "Status",   value: successOrder.status, color: "text-brand capitalize" },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between px-3 py-2">
                    <span className="text-muted-foreground">{row.label}</span>
                    <span className={cn("font-medium font-mono", row.color ?? "text-foreground")}>
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>

              <button
                onClick={onClose}
                className="w-full rounded-lg bg-brand hover:bg-brand/90 text-primary-foreground font-semibold py-2 text-sm transition-colors"
              >
                Done
              </button>
            </div>
          ) : (
            <>
              {/* ── Not logged in ── */}
              {!isLoggedIn && (
                <div className="flex items-start gap-2 rounded-lg border border-border bg-secondary px-4 py-3">
                  <LogIn className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <p className="text-xs text-muted-foreground">
                    You must be{" "}
                    <button onClick={() => { onClose(); onLoginRequired(); }} className="text-brand underline underline-offset-2">
                      logged in
                    </button>{" "}
                    to trade.
                  </p>
                </div>
              )}

              {/* Orders execute via platform wallet — no merchant wallet needed */}

              {/* ── Price pill ── */}
              <div className="flex items-center justify-between rounded-lg bg-secondary border border-border px-4 py-2.5">
                <span className="text-xs text-muted-foreground">Current price</span>
                <span className={cn(
                  "text-sm font-bold font-mono",
                  isYes ? "text-yes" : "text-no"
                )}>
                  {pricePct}¢
                </span>
              </div>

              {/* ── Amount input ── */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Amount (USDC)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                  <input
                    type="number"
                    min={MIN_AMOUNT}
                    max={MAX_AMOUNT}
                    step="0.01"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => { setAmount(e.target.value); clearError(); }}
                    className="w-full rounded-lg border border-border bg-background pl-7 pr-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-brand/40 focus:border-brand/40 transition-colors"
                  />
                </div>

                {/* Preset buttons */}
                <div className="grid grid-cols-4 gap-1.5">
                  {PRESETS.map((p) => (
                    <button
                      key={p}
                      onClick={() => { setAmount(String(p)); clearError(); }}
                      className={cn(
                        "rounded-md border py-1 text-xs font-medium transition-colors",
                        amount === String(p)
                          ? "border-brand bg-brand/10 text-brand"
                          : "border-border bg-secondary text-muted-foreground hover:text-foreground"
                      )}
                    >
                      ${p}
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Summary ── */}
              {numAmount > 0 && (
                <div className="rounded-lg border border-border bg-secondary/50 divide-y divide-border/50 text-xs">
                  {[
                    { label: "Price per share", value: `${pricePct}¢` },
                    { label: "Est. shares",      value: estimShares },
                    { label: "Total cost",        value: `$${numAmount.toFixed(2)}` },
                  ].map((row) => (
                    <div key={row.label} className="flex items-center justify-between px-3 py-2">
                      <span className="text-muted-foreground">{row.label}</span>
                      <span className="font-medium font-mono text-foreground">{row.value}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* ── Error ── */}
              {error && (
                <div className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3">
                  <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  <p className="text-xs text-destructive">{error}</p>
                </div>
              )}

              {/* ── Place Order button ── */}
              <button
                onClick={handleSubmit}
                disabled={isPlacing || (!isLoggedIn ? false : !isValid)}
                className={cn(
                  "w-full rounded-lg font-semibold py-2.5 text-sm transition-colors flex items-center justify-center gap-2",
                  isYes
                    ? "bg-yes hover:bg-yes/90 text-white disabled:opacity-50"
                    : "bg-no  hover:bg-no/90  text-white disabled:opacity-50"
                )}
              >
                {isPlacing ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Placing Order…</>
                ) : !isLoggedIn ? (
                  <><LogIn className="h-4 w-4" /> Log In to Trade</>
                ) : (
                  <>Buy {outcome} — ${numAmount > 0 ? numAmount.toFixed(2) : "0.00"}</>
                )}
              </button>

              <p className="text-center text-[10px] text-muted-foreground">
                Min ${MIN_AMOUNT} · Orders are submitted to Polymarket CLOB ·{" "}
                <a href="https://polymarket.com" target="_blank" rel="noopener noreferrer"
                   className="text-brand hover:underline inline-flex items-center gap-0.5">
                  View on Polymarket <ExternalLink className="h-2.5 w-2.5" />
                </a>
              </p>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
