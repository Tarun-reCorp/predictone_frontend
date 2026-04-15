"use client";

/**
 * use-wallet.ts — retained for Admin panel only.
 *
 * Previously used by the Merchant panel for wallet connect.
 * Now only the Admin panel uses this for the trading wallet display.
 * Merchant panel no longer connects any external wallet.
 */

import { useAdminWallet } from "./use-admin-wallet";

export function useWallet() {
  return useAdminWallet();
}

export { useAdminWallet };
