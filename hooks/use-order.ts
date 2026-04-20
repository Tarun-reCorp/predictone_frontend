"use client";

import { useState, useCallback } from "react";
import { useAuth } from "@/contexts/auth-context";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export interface PlacedOrder {
  _id: string;
  conditionId: string;
  marketId?: string;
  marketQuestion: string;
  outcome: "Yes" | "No";
  side: "buy" | "sell";
  orderType: string;
  amount: number;
  price: number;
  size: number;
  status: string;
  createdAt: string;
}

interface PlaceOrderParams {
  marketId: string;         // our DB market _id, slug, or conditionId
  outcome: "Yes" | "No";
  amount: number;           // dollar amount user wants to spend
  marketQuestion?: string;
}

export function useOrder() {
  const { user, token } = useAuth();

  const [isPlacing, setIsPlacing]   = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [lastOrder, setLastOrder]   = useState<PlacedOrder | null>(null);

  const placeOrder = useCallback(
    async ({ marketId, outcome, amount, marketQuestion }: PlaceOrderParams): Promise<PlacedOrder> => {
      setError(null);
      setIsPlacing(true);
      try {
        const res  = await fetch(`${API}/api/orders/place`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            marketId,
            outcome,
            side: "buy",
            orderType: "market",
            amount,
            price: 50,   // default 50% — backend normalizes to 0.50
            ...(marketQuestion ? { marketQuestion } : {}),
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.message ?? "Order placement failed");

        const order: PlacedOrder = json.data.order;
        setLastOrder(order);
        return order;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Order failed";
        setError(msg);
        throw err;
      } finally {
        setIsPlacing(false);
      }
    },
    [token]
  );

  return {
    placeOrder,
    isPlacing,
    error,
    clearError: () => setError(null),
    lastOrder,
    clearOrder: () => setLastOrder(null),
    isLoggedIn: !!user,
    hasWallet:  true,
    canTrade:   !!user,
  };
}
