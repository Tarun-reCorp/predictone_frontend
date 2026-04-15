"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/auth-context";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface TradingWalletInfo {
  configured: boolean;
  address: string | null;
  apiKeyConfigured: boolean;
  apiKey: string | null;
}

/**
 * Hook for the Admin panel to read the trading wallet info.
 * The trading wallet is configured server-side via POLY_PRIVATE_KEY env var.
 * This hook just reads/displays that info — no browser wallet connection needed.
 */
export function useAdminWallet() {
  const { token } = useAuth();
  const [info, setInfo]       = useState<TradingWalletInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch(`${API}/api/admin/trading-wallet`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Failed to load wallet info");
      setInfo(json.data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  return { info, loading, error, reload: load };
}
