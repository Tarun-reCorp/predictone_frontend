"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/auth-context";
import { isMetaMaskInstalled } from "@/lib/wallet";

type EthereumProvider = {
  isMetaMask?: boolean;
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener: (event: string, handler: (...args: unknown[]) => void) => void;
};

function getEthereum(): EthereumProvider | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { ethereum?: EthereumProvider }).ethereum ?? null;
}

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export function useWallet() {
  const { user, token, updateUser } = useAuth();
  const [chainId, setChainId]           = useState<number | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [error, setError]               = useState<string | null>(null);

  // Stable ref for updateUser so event handlers don't go stale
  const updateUserRef = useRef(updateUser);
  const userRef       = useRef(user);
  useEffect(() => { updateUserRef.current = updateUser; }, [updateUser]);
  useEffect(() => { userRef.current = user; }, [user]);

  // On mount (and when wallet connects), read chain + attach listeners
  useEffect(() => {
    const eth = getEthereum();
    if (!eth) return;

    // Fetch current chain silently
    eth.request({ method: "eth_chainId" })
      .then((id) => setChainId(parseInt(id as string, 16)))
      .catch(() => {});

    const handleAccountsChanged = (raw: unknown) => {
      const accounts = raw as string[];
      // User revoked permission in MetaMask → clear wallet in UI (not DB)
      if (accounts.length === 0 && userRef.current?.walletAddress) {
        updateUserRef.current({ ...userRef.current, walletAddress: null });
        setChainId(null);
      }
    };

    const handleChainChanged = (raw: unknown) => {
      setChainId(parseInt(raw as string, 16));
    };

    eth.on("accountsChanged", handleAccountsChanged);
    eth.on("chainChanged",    handleChainChanged);

    return () => {
      eth.removeListener("accountsChanged", handleAccountsChanged);
      eth.removeListener("chainChanged",    handleChainChanged);
    };
  }, []); // run once — handlers use refs to stay current

  const connect = useCallback(async () => {
    setError(null);

    if (!isMetaMaskInstalled()) {
      setError("MetaMask not installed. Please install the MetaMask browser extension.");
      return;
    }

    const eth = getEthereum()!;
    setIsConnecting(true);

    try {
      // 1. Request accounts (triggers MetaMask popup)
      const accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
      const address  = accounts[0];
      if (!address) throw new Error("No account selected in MetaMask");

      // 2. Get current network
      const chainHex = (await eth.request({ method: "eth_chainId" })) as string;
      setChainId(parseInt(chainHex, 16));

      // 3. Save to backend
      const res  = await fetch(`${API}/api/merchant/connect-wallet`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ walletAddress: address }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Failed to save wallet");

      updateUser(json.data.user);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Connection failed";
      // Silently ignore user-cancelled MetaMask prompts
      if (
        !msg.toLowerCase().includes("user rejected") &&
        !msg.toLowerCase().includes("user denied") &&
        !msg.toLowerCase().includes("cancelled")
      ) {
        setError(msg);
      }
    } finally {
      setIsConnecting(false);
    }
  }, [token, updateUser]);

  const disconnect = useCallback(async () => {
    setError(null);
    setIsDisconnecting(true);
    try {
      const res  = await fetch(`${API}/api/merchant/wallet`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Failed to disconnect wallet");
      updateUser(json.data.user);
      setChainId(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Disconnect failed");
    } finally {
      setIsDisconnecting(false);
    }
  }, [token, updateUser]);

  const copyAddress = useCallback(async () => {
    if (user?.walletAddress) {
      await navigator.clipboard.writeText(user.walletAddress);
    }
  }, [user?.walletAddress]);

  return {
    address:        user?.walletAddress ?? null,
    chainId,
    isConnecting,
    isDisconnecting,
    isInstalled:    isMetaMaskInstalled(),
    error,
    clearError:     () => setError(null),
    connect,
    disconnect,
    copyAddress,
  };
}
