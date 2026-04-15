/**
 * All Polymarket data flows through the Express backend.
 * Server-side functions  → call  BACKEND/api/polymarket/*  directly.
 * Client-side functions  → call  /api/*  Next.js proxy routes, which
 *                          forward to the same backend endpoints.
 */

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

// ── Types ────────────────────────────────────────────────────────────────────

export interface PolyMarket {
  id: string;
  question: string;
  conditionId: string;
  slug: string;
  resolutionSource?: string;
  endDate: string;
  liquidity: number;
  startDate: string;
  image?: string;
  icon?: string;
  description?: string;
  tags?: Tag[];
  outcomes: string;
  outcomePrices: string;
  volume: number;
  active: boolean;
  closed: boolean;
  archived: boolean;
  new: boolean;
  featured: boolean;
  restricted: boolean;
  groupItemTitle?: string;
  groupItemThreshold?: string;
  questionID: string;
  enableOrderBook: boolean;
  orderPriceMinTickSize: number;
  orderMinSize: number;
  volumeNum: number;
  liquidityNum: number;
  clobTokenIds?: string;
}

export interface PolyEvent {
  id: string;
  title: string;
  slug: string;
  description?: string;
  startDate: string;
  endDate: string;
  image?: string;
  icon?: string;
  active: boolean;
  closed: boolean;
  liquidity: number;
  volume: number;
  markets: PolyMarket[];
  tags?: Tag[];
  category?: string;
}

export interface Tag {
  id: string;
  label: string;
  slug: string;
  forceShow?: boolean;
}

export interface Leaderboard {
  name: string;
  address: string;
  profitAndLoss: number;
  percentProfitAndLoss?: number;
  volume?: number;
}

export interface PriceHistory {
  t: number;
  p: number;
}

export interface OrderBook {
  market: string;
  asset_id: string;
  bids: { price: string; size: string }[];
  asks: { price: string; size: string }[];
}

export interface OrderBookLevel {
  price: string;
  size: string;
}

export interface OrderBookData {
  market: string;
  asset_id: string;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  hash?: string;
}

// ── Server-side helpers (SSR / server components) ────────────────────────────
// These call the backend directly using an absolute URL so they work in
// both server components and Next.js API route handlers.

export async function fetchMarkets(params?: {
  limit?: number;
  offset?: number;
  active?: boolean;
  closed?: boolean;
  tag?: string;
  order?: string;
  ascending?: boolean;
}): Promise<PolyMarket[]> {
  const query = new URLSearchParams();
  if (params?.limit)   query.set("limit",     String(params.limit));
  if (params?.offset)  query.set("offset",    String(params.offset));
  if (params?.active  !== undefined) query.set("active",    String(params.active));
  if (params?.closed  !== undefined) query.set("closed",    String(params.closed));
  if (params?.tag)     query.set("tag_slug",  params.tag);
  if (params?.order)   query.set("order",     params.order);
  if (params?.ascending !== undefined) query.set("ascending", String(params.ascending));

  const res = await fetch(`${BACKEND}/api/polymarket/markets?${query}`, {
    next: { revalidate: 60 },
  });
  if (!res.ok) return [];
  return res.json();
}

export async function fetchEvents(params?: {
  limit?: number;
  offset?: number;
  active?: boolean;
  closed?: boolean;
  tag?: string;
  order?: string;
}): Promise<PolyEvent[]> {
  const query = new URLSearchParams();
  query.set("limit", String(params?.limit ?? 20));
  if (params?.offset  !== undefined) query.set("offset",   String(params.offset));
  if (params?.active  !== undefined) query.set("active",   String(params.active));
  if (params?.closed  !== undefined) query.set("closed",   String(params.closed));
  if (params?.tag)    query.set("tag_slug", params.tag);
  if (params?.order)  query.set("order",    params.order ?? "volume");

  const res = await fetch(`${BACKEND}/api/polymarket/events?${query}`, {
    next: { revalidate: 60 },
  });
  if (!res.ok) return [];
  return res.json();
}

export async function fetchMarketById(slugOrId: string): Promise<PolyMarket | null> {
  const res = await fetch(
    `${BACKEND}/api/polymarket/markets/${encodeURIComponent(slugOrId)}`,
    { next: { revalidate: 30 } }
  );
  if (!res.ok) return null;
  const json = await res.json();
  // Backend wraps in { data: { market } }
  return json?.data?.market ?? null;
}

export async function fetchPriceHistory(
  conditionId: string,
  interval = "1d"
): Promise<PriceHistory[]> {
  try {
    const res = await fetch(
      `${BACKEND}/api/polymarket/prices?market=${encodeURIComponent(conditionId)}&interval=${interval}&fidelity=60`,
      { next: { revalidate: 60 } }
    );
    if (!res.ok) return [];
    const data = await res.json();

    // Defensive: ensure we return an array
    const history = data.history ?? data ?? [];
    return Array.isArray(history) ? history : [];
  } catch {
    return [];
  }
}

export async function fetchLeaderboard(limit = 10): Promise<Leaderboard[]> {
  const res = await fetch(
    `${BACKEND}/api/polymarket/leaderboard?limit=${limit}&window=monthly`,
    { next: { revalidate: 300 } }
  );
  if (!res.ok) return [];
  return res.json();
}

// ── Client-side helpers ───────────────────────────────────────────────────────
// Call the Express backend directly — NEXT_PUBLIC_API_URL is available in the
// browser and the backend allows localhost:* in development CORS config.

export async function clientFetchMarkets(params?: {
  limit?: number;
  offset?: number;
  active?: boolean;
  closed?: boolean;
  tag?: string;
  category?: string;
  order?: string;
  ascending?: boolean;
}): Promise<PolyMarket[]> {
  const query = new URLSearchParams();
  if (params?.limit)    query.set("limit",     String(params.limit));
  if (params?.offset)   query.set("offset",    String(params.offset));
  if (params?.active   !== undefined) query.set("active",    String(params.active));
  if (params?.closed   !== undefined) query.set("closed",    String(params.closed));
  if (params?.tag)      query.set("tag_slug",  params.tag);
  if (params?.category) query.set("category",  params.category);
  if (params?.order)    query.set("order",     params.order);
  if (params?.ascending !== undefined) query.set("ascending", String(params.ascending));

  const res = await fetch(`${BACKEND}/api/polymarket/markets?${query}`);
  if (!res.ok) return [];
  return res.json();
}

export async function clientFetchMarketById(id: string): Promise<PolyMarket | null> {
  const res = await fetch(`${BACKEND}/api/polymarket/markets/${encodeURIComponent(id)}`);
  if (!res.ok) return null;
  const json = await res.json();
  // Backend wraps single market in { success, data: { market } }
  return json?.data?.market ?? null;
}

export async function clientFetchPriceHistory(
  conditionId: string,
  interval = "1w"
): Promise<PriceHistory[]> {
  try {
    const res = await fetch(
      `${BACKEND}/api/polymarket/prices?market=${encodeURIComponent(conditionId)}&interval=${interval}&fidelity=60`
    );
    if (!res.ok) return [];
    const data = await res.json();

    // Defensive: ensure we return an array
    const history = data.history ?? data ?? [];
    return Array.isArray(history) ? history : [];
  } catch {
    return [];
  }
}

export async function clientFetchLeaderboard(limit = 10): Promise<Leaderboard[]> {
  const res = await fetch(
    `${BACKEND}/api/polymarket/leaderboard?limit=${limit}&window=monthly`
  );
  if (!res.ok) return [];
  return res.json();
}

export async function clientFetchOrderBook(tokenId: string): Promise<OrderBookData | null> {
  const res = await fetch(
    `${BACKEND}/api/polymarket/clob?endpoint=book&token_id=${encodeURIComponent(tokenId)}`
  );
  if (!res.ok) return null;
  return res.json();
}

export async function clientFetchMidpoints(tokenIds: string[]): Promise<Record<string, number>> {
  if (tokenIds.length === 0) return {};
  const params = tokenIds.map((id) => `token_id=${encodeURIComponent(id)}`).join("&");
  const res = await fetch(`${BACKEND}/api/polymarket/clob?endpoint=midpoints&${params}`);
  if (!res.ok) return {};
  const data = await res.json();
  const result: Record<string, number> = {};
  for (const [k, v] of Object.entries(data)) {
    result[k] = parseFloat(String(v));
  }
  return result;
}

// ── Utility helpers ───────────────────────────────────────────────────────────

export function parseOutcomePrices(pricesStr?: string): number[] {
  if (!pricesStr) return [0.5, 0.5];
  try {
    const parsed = JSON.parse(pricesStr);
    return parsed.map((p: string | number) => parseFloat(String(p)));
  } catch {
    return [0.5, 0.5];
  }
}

export function parseOutcomes(outcomesStr?: string): string[] {
  if (!outcomesStr) return ["Yes", "No"];
  try {
    return JSON.parse(outcomesStr);
  } catch {
    return ["Yes", "No"];
  }
}

export function formatVolume(n?: number): string {
  if (!n) return "$0";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}
