/**
 * Market data layer — reads from local DB via /api/markets endpoints.
 * Polymarket is only used as a sync source (cron job on backend).
 *
 * Server-side functions  → call  BACKEND/api/markets/*  directly.
 * Client-side functions  → call  BACKEND/api/markets/*  directly
 *                          (NEXT_PUBLIC_API_URL is browser-accessible).
 *
 * All responses are transformed to the PolyMarket interface so existing
 * components continue working without modification.
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
  // DB-specific fields exposed for new features
  category?: string;
  marketUniqueId?: string;
  yesPercent?: number;
  noPercent?: number;
  yesPool?: number;
  noPool?: number;
  totalOrders?: number;
  totalUsers?: number;
  status?: string;
  result?: string | null;
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

// ── DB → PolyMarket transform ───────────────────────────────────────────────
// Maps our MongoDB Market document to the PolyMarket interface shape
// so all existing UI components render correctly.

function transformDbMarket(m: any): PolyMarket {
  const yesPrice = m.yesPrice ?? 0.5;
  const noPrice = m.noPrice ?? 0.5;
  const vol = m.totalVolume ?? 0;

  return {
    id: m._id ?? m.id ?? "",
    question: m.question ?? "",
    conditionId: m.conditionId ?? m._id ?? "",
    slug: m.slug ?? "",
    endDate: m.endDate ?? "",
    startDate: m.startDate ?? m.createdAt ?? "",
    image: m.image ?? undefined,
    icon: m.icon ?? undefined,
    description: m.description ?? undefined,
    outcomes: JSON.stringify(["Yes", "No"]),
    outcomePrices: JSON.stringify([
      yesPrice.toFixed(4),
      noPrice.toFixed(4),
    ]),
    volume: vol,
    volumeNum: vol,
    liquidity: vol,
    liquidityNum: vol,
    active: m.active ?? m.status === "active",
    closed: m.closed ?? m.status === "closed",
    archived: m.status === "cancelled",
    new: isNew(m.createdAt),
    featured: vol > 1000,
    restricted: false,
    questionID: m.conditionId ?? m._id ?? "",
    enableOrderBook: false,
    orderPriceMinTickSize: 0.01,
    orderMinSize: 1,
    // DB-specific fields
    category: m.category ?? "Other",
    marketUniqueId: m.marketUniqueId ?? undefined,
    yesPercent: m.yesPercent ?? 50,
    noPercent: m.noPercent ?? 50,
    yesPool: m.yesPool ?? 0,
    noPool: m.noPool ?? 0,
    totalOrders: m.totalOrders ?? 0,
    totalUsers: m.totalUsers ?? 0,
    status: m.status ?? "active",
    result: m.result ?? null,
  };
}

function isNew(createdAt?: string): boolean {
  if (!createdAt) return false;
  const diff = Date.now() - new Date(createdAt).getTime();
  return diff < 7 * 24 * 60 * 60 * 1000; // less than 7 days old
}

// ── Server-side helpers (SSR / server components) ────────────────────────────

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
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.offset) {
    // Convert offset to page number (offset / limit = page - 1)
    const limit = params?.limit ?? 20;
    const page = Math.floor(params.offset / limit) + 1;
    query.set("page", String(page));
  }
  query.set("limit", String(params?.limit ?? 20));

  const res = await fetch(`${BACKEND}/api/markets?${query}`, {
    next: { revalidate: 60 },
  });
  if (!res.ok) return [];
  const json = await res.json();
  const markets = json?.data ?? json ?? [];
  return Array.isArray(markets) ? markets.map(transformDbMarket) : [];
}

export async function fetchEvents(params?: {
  limit?: number;
  offset?: number;
  active?: boolean;
  closed?: boolean;
  tag?: string;
  order?: string;
}): Promise<PolyEvent[]> {
  // Events are still served from Polymarket proxy (not stored in our DB)
  const query = new URLSearchParams();
  query.set("limit", String(params?.limit ?? 20));
  if (params?.offset !== undefined) query.set("offset", String(params.offset));
  if (params?.active !== undefined) query.set("active", String(params.active));
  if (params?.closed !== undefined) query.set("closed", String(params.closed));
  if (params?.tag) query.set("tag_slug", params.tag);
  if (params?.order) query.set("order", params.order ?? "volume");

  const res = await fetch(`${BACKEND}/api/polymarket/events?${query}`, {
    next: { revalidate: 60 },
  });
  if (!res.ok) return [];
  return res.json();
}

export async function fetchMarketById(slugOrId: string): Promise<PolyMarket | null> {
  const res = await fetch(
    `${BACKEND}/api/markets/${encodeURIComponent(slugOrId)}`,
    { next: { revalidate: 30 } }
  );
  if (!res.ok) return null;
  const json = await res.json();
  const market = json?.data?.market ?? null;
  return market ? transformDbMarket(market) : null;
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

export async function clientFetchMarkets(params?: {
  limit?: number;
  offset?: number;
  active?: boolean;
  closed?: boolean;
  tag?: string;
  category?: string;
  order?: string;
  ascending?: boolean;
  search?: string;
}): Promise<PolyMarket[]> {
  const query = new URLSearchParams();
  const limit = params?.limit ?? 20;
  query.set("limit", String(limit));

  if (params?.offset) {
    const page = Math.floor(params.offset / limit) + 1;
    query.set("page", String(page));
  }
  if (params?.category) query.set("category", params.category);

  // If search is provided, use the search endpoint
  if (params?.search) {
    query.set("q", params.search);
    const res = await fetch(`${BACKEND}/api/markets/search?${query}`);
    if (!res.ok) return [];
    const json = await res.json();
    const markets = json?.data ?? json ?? [];
    return Array.isArray(markets) ? markets.map(transformDbMarket) : [];
  }

  const res = await fetch(`${BACKEND}/api/markets?${query}`);
  if (!res.ok) return [];
  const json = await res.json();
  const markets = json?.data ?? json ?? [];
  return Array.isArray(markets) ? markets.map(transformDbMarket) : [];
}

export async function clientFetchMarketById(id: string): Promise<PolyMarket | null> {
  const res = await fetch(`${BACKEND}/api/markets/${encodeURIComponent(id)}`);
  if (!res.ok) return null;
  const json = await res.json();
  const market = json?.data?.market ?? null;
  return market ? transformDbMarket(market) : null;
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
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}
