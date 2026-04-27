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
  isConnected: boolean;
  address: string | null;
  chainId: number | null;
  balance: string | null;
  loading: boolean;
  connect: () => void;
  disconnect: () => Promise<void>;
  changeWallet: () => void;
  refreshBalance: () => Promise<void>;
}

const noop = async () => {};

const defaultState: WalletState = {
  isConnected: false,
  address: null,
  chainId: null,
  balance: null,
  loading: false,
  connect: () => {},
  disconnect: noop,
  changeWallet: () => {},
  refreshBalance: noop,
};

const WalletContext = createContext<WalletState>(defaultState);

// Inner component — only mounts on client, safe to call Web3Modal hooks
function WalletProviderInner({ children }: { children: ReactNode }) {
  const { open } = useWeb3Modal();
  const { address, chainId, isConnected } = useWeb3ModalAccount();
  const { disconnect: w3Disconnect } = useDisconnect();
  const { walletProvider } = useWeb3ModalProvider();

  const [balance, setBalance] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refreshBalance = useCallback(async () => {
    if (!walletProvider || !address) { setBalance(null); return; }
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

  useEffect(() => {
    if (isConnected && address) refreshBalance();
    else setBalance(null);
  }, [isConnected, address, chainId, refreshBalance]);

  const connect      = useCallback(() => open(), [open]);
  const disconnect   = useCallback(async () => { await w3Disconnect(); setBalance(null); }, [w3Disconnect]);
  const changeWallet = useCallback(() => open(), [open]);

  return (
    <WalletContext.Provider value={{
      isConnected,
      address: address ?? null,
      chainId: chainId ?? null,
      balance,
      loading,
      connect,
      disconnect,
      changeWallet,
      refreshBalance,
    }}>
      {children}
    </WalletContext.Provider>
  );
}

// Outer provider — SSR safe, renders default state until client mounts
export function WalletProvider({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  if (!mounted) {
    return (
      <WalletContext.Provider value={defaultState}>
        {children}
      </WalletContext.Provider>
    );
  }

  return <WalletProviderInner>{children}</WalletProviderInner>;
}

export function useWalletContext() {
  return useContext(WalletContext);
}
