"use client";

import { createContext, useContext, type ReactNode } from "react";

// Crypto wallet integration is currently disabled.
// All methods are no-ops; isConnected is always false.

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
  isConnected:    false,
  address:        null,
  chainId:        null,
  balance:        null,
  loading:        false,
  connect:        () => {},
  disconnect:     noop,
  changeWallet:   () => {},
  refreshBalance: noop,
};

const WalletContext = createContext<WalletState>(defaultState);

export function WalletProvider({ children }: { children: ReactNode }) {
  return (
    <WalletContext.Provider value={defaultState}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWalletContext() {
  return useContext(WalletContext);
}
