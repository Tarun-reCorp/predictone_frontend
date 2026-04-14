"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  useWeb3Modal,
  useWeb3ModalAccount,
  useWeb3ModalProvider,
  useDisconnect,
} from "@web3modal/ethers/react";
import { useAuth } from "@/contexts/auth-context";

type Eip1193Request = (args: { method: string; params?: unknown[] }) => Promise<unknown>;

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export function useWallet() {
  const { user, token, updateUser } = useAuth();
  const { open }                     = useWeb3Modal();
  const { disconnect: wcDisconnect } = useDisconnect();
  const { address, chainId, isConnected } = useWeb3ModalAccount();
  const { walletProvider }           = useWeb3ModalProvider();

  const [isConnecting, setIsConnecting]       = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [error, setError]                     = useState<string | null>(null);

  // Use a ref to track the current session key (address + provider combo).
  // If the key changes mid-flight (network switch), we ignore the stale request.
  const sessionKeyRef  = useRef<string | null>(null);
  const verifyingRef   = useRef(false);

  // ── Auto sign + verify when wallet connects ──────────────────────────────
  useEffect(() => {
    if (!isConnected || !address || !walletProvider || !token) return;

    // Already linked — nothing to do
    const saved = user?.walletAddress;
    if (saved && saved.toLowerCase() === address.toLowerCase()) return;

    // Build a session key: address + a stable id for this provider instance.
    // This prevents re-triggering when the provider object reference changes
    // (e.g. on network switch) for the SAME underlying wallet session.
    const sessionKey = address.toLowerCase();

    // Skip if we're already verifying FOR THIS ADDRESS
    if (verifyingRef.current && sessionKeyRef.current === sessionKey) return;

    // If a different address shows up mid-flight, let it proceed
    verifyingRef.current  = true;
    sessionKeyRef.current = sessionKey;
    setIsConnecting(true);
    setError(null);

    (async () => {
      try {
        // 1. Get a one-time nonce message from the backend
        const nonceRes  = await fetch(
          `${API}/api/merchant/wallet/nonce?address=${address}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const nonceJson = await nonceRes.json();
        if (!nonceRes.ok) throw new Error(nonceJson.message ?? "Failed to get nonce");
        const message: string = nonceJson.data.message;

        // Guard: if address changed while we were fetching the nonce, abort
        if (sessionKeyRef.current !== address.toLowerCase()) return;

        // 2. Ask the wallet to sign the message
        //    personal_sign([message, address]) — plain string, address second
        const request   = (walletProvider as { request: Eip1193Request }).request.bind(walletProvider);
        const signature = (await request({
          method: "personal_sign",
          params: [message, address],
        })) as string;

        // 3. Send address + signature + the EXACT message that was signed.
        //    Backend verifies against this message, not a potentially-overwritten nonce.
        const verifyRes  = await fetch(`${API}/api/merchant/wallet/verify`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ address, signature, message }),
        });
        const verifyJson = await verifyRes.json();
        if (!verifyRes.ok) throw new Error(verifyJson.message ?? "Wallet verification failed");

        updateUser(verifyJson.data.user);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Connection failed";
        if (
          !msg.toLowerCase().includes("user rejected") &&
          !msg.toLowerCase().includes("user denied") &&
          !msg.toLowerCase().includes("cancelled")
        ) {
          setError(msg);
        }
        await wcDisconnect().catch(() => {});
      } finally {
        setIsConnecting(false);
        verifyingRef.current = false;
      }
    })();
  // walletProvider intentionally excluded — we key on address instead
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, address, token]);

  const connect = useCallback(async () => {
    setError(null);
    await open();
  }, [open]);

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
      await wcDisconnect().catch(() => {});
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Disconnect failed");
    } finally {
      setIsDisconnecting(false);
    }
  }, [token, updateUser, wcDisconnect]);

  const copyAddress = useCallback(async () => {
    const addr = user?.walletAddress ?? address;
    if (addr) await navigator.clipboard.writeText(addr);
  }, [user?.walletAddress, address]);

  return {
    address:        user?.walletAddress ?? null,
    chainId:        (chainId as number) ?? null,
    isConnecting,
    isDisconnecting,
    isInstalled:    true,
    error,
    clearError:     () => setError(null),
    connect,
    disconnect,
    copyAddress,
  };
}
