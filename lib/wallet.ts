export const CHAIN_NAMES: Record<number, string> = {
  1:        "Ethereum",
  137:      "Polygon",
  80001:    "Mumbai",
  80002:    "Amoy",
  11155111: "Sepolia",
  56:       "BNB Chain",
  42161:    "Arbitrum",
  10:       "Optimism",
  8453:     "Base",
};

export const CHAIN_COLORS: Record<number, string> = {
  1:   "text-blue-400",
  137: "text-purple-400",
  56:  "text-yellow-400",
};

export function shortenAddress(addr: string, chars = 4): string {
  return `${addr.slice(0, chars + 2)}…${addr.slice(-chars)}`;
}

export function isMetaMaskInstalled(): boolean {
  if (typeof window === "undefined") return false;
  return !!(window as unknown as { ethereum?: { isMetaMask?: boolean } }).ethereum?.isMetaMask;
}

export function getChainName(chainId: number | null): string {
  if (!chainId) return "Unknown";
  return CHAIN_NAMES[chainId] ?? `Chain ${chainId}`;
}
