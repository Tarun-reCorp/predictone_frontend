"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import {
  useWeb3Modal,
  useWeb3ModalAccount,
  useDisconnect,
  useWeb3ModalProvider,
} from "@web3modal/ethers/react";
import { BrowserProvider, formatEther } from "ethers";

interface WalletState {
  /** Whether a wallet is currently connected */
  isConnected: boolean;
  /** Connected wallet address (checksummed) */
  address: string | null;
  /** Chain ID the wallet is on */
  chainId: number | null;
  /** ETH/native balance (formatted string) */
  balance: string | null;
  /** Loading balance or processing action */
  loading: boolean;
  /** Open web3modal to connect */
  connect: () => void;
  /** Disconnect wallet */
  disconnect: () => Promise<void>;
  /** Open web3modal to switch wallet */
  changeWallet: () => void;
  /** Refresh balance */
  refreshBalance: () => Promise<void>;
}

const WalletContext = createContext<WalletState | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const { open } = useWeb3Modal();
  const { address, chainId, isConnected } = useWeb3ModalAccount();
  const { disconnect: w3Disconnect } = useDisconnect();
  const { walletProvider } = useWeb3ModalProvider();

  const [balance, setBalance] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refreshBalance = useCallback(async () => {
    if (!walletProvider || !address) {
      setBalance(null);
      return;
    }
    try {
      setLoading(true);
      const provider = new BrowserProvider(walletProvider);
      const raw = await provider.getBalance(address);
      setBalance(formatEther(raw));
    } catch {
      setBalance(null);
    } finally {
      setLoading(false);
    }
  }, [walletProvider, address]);

  // Auto-fetch balance on connect / chain change
  useEffect(() => {
    if (isConnected && address) {
      refreshBalance();
    } else {
      setBalance(null);
    }
  }, [isConnected, address, chainId, refreshBalance]);

  const connect = useCallback(() => {
    open();
  }, [open]);

  const disconnect = useCallback(async () => {
    await w3Disconnect();
    setBalance(null);
  }, [w3Disconnect]);

  const changeWallet = useCallback(() => {
    open();
  }, [open]);

  return (
    <WalletContext.Provider
      value={{
        isConnected,
        address: address ?? null,
        chainId: chainId ?? null,
        balance,
        loading,
        connect,
        disconnect,
        changeWallet,
        refreshBalance,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWalletContext() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWalletContext must be used inside WalletProvider");
  return ctx;
}
