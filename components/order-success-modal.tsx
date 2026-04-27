"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { CheckCircle2, Loader2, TrendingUp, TrendingDown, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type Phase = "loading" | "success" | "error";

interface OrderSuccessModalProps {
  open: boolean;
  onClose: () => void;
  isPlacing: boolean;
  outcome: "Yes" | "No" | null;
  amount: number;
  error?: string | null;
}

export function OrderSuccessModal({
  open,
  onClose,
  isPlacing,
  outcome,
  amount,
  error,
}: OrderSuccessModalProps) {
  const [phase, setPhase] = useState<Phase>("loading");
  const isYes = outcome === "Yes";

  // When modal first opens: if order is already done, skip loading phase immediately
  useEffect(() => {
    if (open) {
      setPhase(isPlacing ? "loading" : error ? "error" : "success");
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // When order finishes while modal is open: transition to result
  useEffect(() => {
    if (!open || isPlacing) return;
    setPhase(error ? "error" : "success");
  }, [isPlacing, error, open]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && phase !== "loading") onClose(); }}>
      <DialogContent className="max-w-xs p-0 overflow-hidden border border-border bg-card">
        <div className="p-6 flex flex-col items-center gap-4 text-center">

          {/* ── Loading ── */}
          {phase === "loading" && (
            <>
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand/10">
                <Loader2 className="h-7 w-7 animate-spin text-brand" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Placing Order…</p>
                <p className="text-xs text-muted-foreground mt-1">Please wait</p>
              </div>
            </>
          )}

          {/* ── Success ── */}
          {phase === "success" && (
            <>
              <div className={cn(
                "flex h-14 w-14 items-center justify-center rounded-full",
                isYes ? "bg-yes/15" : "bg-no/15"
              )}>
                <CheckCircle2 className={cn("h-7 w-7", isYes ? "text-yes" : "text-no")} />
              </div>

              <div>
                <p className="text-base font-bold text-foreground">Order Placed!</p>
                <p className="text-xs text-muted-foreground mt-1">Your order was submitted successfully.</p>
              </div>

              <div className="w-full rounded-lg border border-border bg-secondary/50 divide-y divide-border/50 text-xs">
                <div className="flex items-center justify-between px-3 py-2.5">
                  <span className="text-muted-foreground">Outcome</span>
                  <span className={cn("flex items-center gap-1 font-semibold", isYes ? "text-yes" : "text-no")}>
                    {isYes ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {outcome}
                  </span>
                </div>
                <div className="flex items-center justify-between px-3 py-2.5">
                  <span className="text-muted-foreground">Amount</span>
                  <span className="font-mono font-semibold text-foreground">${amount.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between px-3 py-2.5">
                  <span className="text-muted-foreground">Status</span>
                  <span className="font-semibold text-brand capitalize">matched</span>
                </div>
              </div>

              <button
                onClick={onClose}
                className={cn(
                  "w-full rounded-lg font-semibold py-2.5 text-sm transition-colors text-white",
                  isYes ? "bg-yes hover:bg-yes/90" : "bg-no hover:bg-no/90"
                )}
              >
                Done
              </button>
            </>
          )}

          {/* ── Error ── */}
          {phase === "error" && (
            <>
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
                <AlertCircle className="h-7 w-7 text-destructive" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Order Failed</p>
                <p className="text-xs text-muted-foreground mt-1">{error}</p>
              </div>
              <button
                onClick={onClose}
                className="w-full rounded-lg border border-border bg-secondary hover:bg-secondary/80 text-foreground font-semibold py-2.5 text-sm transition-colors"
              >
                Close
              </button>
            </>
          )}

        </div>
      </DialogContent>
    </Dialog>
  );
}
