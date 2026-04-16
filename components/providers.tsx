"use client";

import { createWeb3Modal, defaultConfig } from "@web3modal/ethers/react";
import { AuthProvider } from "@/contexts/auth-context";
import { WalletProvider } from "@/contexts/wallet-context";

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "";

const metadata = {
  name: "PredictOne",
  description: "PredictOne Prediction Markets",
  url: "https://predictone.app",
  icons: [],
};

// Support all common chains — prevents "Switch Network" loop
// Signing works on any chain; we don't enforce a specific one
const ethereum = {
  chainId: 1,
  name: "Ethereum",
  currency: "ETH",
  explorerUrl: "https://etherscan.io",
  rpcUrl: "https://cloudflare-eth.com",
};

const polygon = {
  chainId: 137,
  name: "Polygon",
  currency: "POL",
  explorerUrl: "https://polygonscan.com",
  rpcUrl: "https://polygon-rpc.com",
};

const bsc = {
  chainId: 56,
  name: "BNB Chain",
  currency: "BNB",
  explorerUrl: "https://bscscan.com",
  rpcUrl: "https://bsc-dataseed.binance.org",
};

const arbitrum = {
  chainId: 42161,
  name: "Arbitrum",
  currency: "ETH",
  explorerUrl: "https://arbiscan.io",
  rpcUrl: "https://arb1.arbitrum.io/rpc",
};

createWeb3Modal({
  ethersConfig: defaultConfig({ metadata }),
  chains: [ethereum, polygon, bsc, arbitrum],
  projectId,
  enableWalletConnect: true,
  enableInjected: true,   // allow Trust Wallet extension too
  enableEIP6963: true,    // allow EIP-6963 wallets (Trust Wallet extension)
  enableCoinbase: false,
  themeMode: "dark",
  themeVariables: {
    "--w3m-accent": "oklch(0.7 0.2 145)",
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <WalletProvider>{children}</WalletProvider>
    </AuthProvider>
  );
}
