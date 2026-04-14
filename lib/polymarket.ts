const GAMMA_API = "https://gamma-api.polymarket.com";
const DATA_API = "https://data-api.polymarket.com";
const CLOB_API = "https://clob.polymarket.com";

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

// Fetch markets from Gamma API
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
  if (params?.offset) query.set("offset", String(params.offset));
  if (params?.active !== undefined) query.set("active", String(params.active));
  if (params?.closed !== undefined) query.set("closed", String(params.closed));
  if (params?.tag) query.set("tag_slug", params.tag);
  if (params?.order) query.set("order", params.order);
  if (params?.ascending !== undefined) query.set("ascending", String(params.ascending));

  const res = await fetch(`${GAMMA_API}/markets?${query.toString()}`, {
    next: { revalidate: 60 },
  });
  if (!res.ok) return [];
  return res.json();
}

// Fetch events from Gamma API
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
  if (params?.offset) query.set("offset", String(params.offset));
  if (params?.active !== undefined) query.set("active", String(params.active));
  if (params?.closed !== undefined) query.set("closed", String(params.closed));
  if (params?.tag) query.set("tag_slug", params.tag);
  if (params?.order) query.set("order", params.order ?? "volume");

  const res = await fetch(`${GAMMA_API}/events?${query.toString()}`, {
    next: { revalidate: 60 },
  });
  if (!res.ok) return [];
  return res.json();
}

// Fetch single event by slug
export async function fetchEventBySlug(slug: string): Promise<PolyEvent | null> {
  const res = await fetch(`${GAMMA_API}/events?slug=${slug}`, {
    next: { revalidate: 60 },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return Array.isArray(data) ? data[0] ?? null : data ?? null;
}

// Fetch single market by slug, numeric id, or conditionId (0x...)
export async function fetchMarketById(slugOrId: string): Promise<PolyMarket | null> {
  // Strategy 1: slug lookup (covers human-readable slugs like "will-trump-win-2024")
  const bySlug = await fetch(
    `${GAMMA_API}/markets?slug=${encodeURIComponent(slugOrId)}&limit=1`,
    { next: { revalidate: 30 } }
  );
  if (bySlug.ok) {
    const data = await bySlug.json();
    const arr = Array.isArray(data) ? data : [];
    if (arr.length > 0) return arr[0];
  }

  // Strategy 2: condition_id lookup (covers 0x... hex condition IDs)
  if (slugOrId.startsWith("0x")) {
    const byCondition = await fetch(
      `${GAMMA_API}/markets?condition_id=${encodeURIComponent(slugOrId)}&limit=1`,
      { next: { revalidate: 30 } }
    );
    if (byCondition.ok) {
      const data = await byCondition.json();
      const arr = Array.isArray(data) ? data : [];
      if (arr.length > 0) return arr[0];
    }
  }

  // Strategy 3: numeric id direct lookup
  if (/^\d+$/.test(slugOrId)) {
    const byId = await fetch(`${GAMMA_API}/markets/${slugOrId}`, {
      next: { revalidate: 30 },
    });
    if (byId.ok) {
      const d = await byId.json();
      if (Array.isArray(d)) return d[0] ?? null;
      if (d && typeof d === "object" && !Array.isArray(d)) return d;
    }
  }

  return null;
}

// Fetch tags
export async function fetchTags(): Promise<Tag[]> {
  const res = await fetch(`${GAMMA_API}/tags`, {
    next: { revalidate: 300 },
  });
  if (!res.ok) return [];
  return res.json();
}

// Fetch price history from CLOB using conditionId (market parameter)
export async function fetchPriceHistory(
  conditionId: string,
  interval = "1d"
): Promise<PriceHistory[]> {
  const res = await fetch(
    `${CLOB_API}/prices-history?market=${encodeURIComponent(conditionId)}&interval=${interval}&fidelity=60`,
    { next: { revalidate: 60 } }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return data.history ?? [];
}

// Fetch leaderboard from Data API
export async function fetchLeaderboard(limit = 10): Promise<Leaderboard[]> {
  const res = await fetch(
    `${DATA_API}/leaderboard?limit=${limit}&window=monthly`,
    { next: { revalidate: 300 } }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return data ?? [];
}

// Search markets
export async function searchMarkets(query: string, limit = 20): Promise<PolyMarket[]> {
  const res = await fetch(
    `${GAMMA_API}/markets?limit=${limit}&active=true&_c=${encodeURIComponent(query)}`,
    { next: { revalidate: 30 } }
  );
  if (!res.ok) return [];
  return res.json();
}

// ─── Client-side helpers (call our own API proxy routes to avoid CORS) ────────

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
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.offset) query.set("offset", String(params.offset));
  if (params?.active !== undefined) query.set("active", String(params.active));
  if (params?.closed !== undefined) query.set("closed", String(params.closed));
  if (params?.tag) query.set("tag_slug", params.tag);
  if (params?.category) query.set("category", params.category);
  if (params?.order) query.set("order", params.order);
  if (params?.ascending !== undefined) query.set("ascending", String(params.ascending));

  const res = await fetch(`/api/markets?${query.toString()}`);
  if (!res.ok) return [];
  return res.json();
}

export async function clientFetchMarketById(id: string): Promise<PolyMarket | null> {
  const res = await fetch(`/api/markets/${encodeURIComponent(id)}`);
  if (!res.ok) return null;
  return res.json();
}

export async function clientFetchPriceHistory(
  conditionId: string,
  interval = "1w"
): Promise<PriceHistory[]> {
  const res = await fetch(`/api/prices?market=${encodeURIComponent(conditionId)}&interval=${interval}&fidelity=60`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.history ?? [];
}

export async function clientFetchLeaderboard(limit = 10): Promise<Leaderboard[]> {
  const res = await fetch(`/api/leaderboard?limit=${limit}&window=monthly`);
  if (!res.ok) return [];
  return res.json();
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

export async function clientFetchOrderBook(tokenId: string): Promise<OrderBookData | null> {
  const res = await fetch(`/api/clob?endpoint=book&token_id=${encodeURIComponent(tokenId)}`);
  if (!res.ok) return null;
  return res.json();
}

export async function clientFetchMidpoints(tokenIds: string[]): Promise<Record<string, number>> {
  if (tokenIds.length === 0) return {};
  const params = tokenIds.map((id) => `token_id=${encodeURIComponent(id)}`).join("&");
  const res = await fetch(`/api/clob?endpoint=midpoints&${params}`);
  if (!res.ok) return {};
  const data = await res.json();
  // midpoints returns { "tokenId": "0.67", ... }
  const result: Record<string, number> = {};
  for (const [k, v] of Object.entries(data)) {
    result[k] = parseFloat(String(v));
  }
  return result;
}

// Parse outcome prices safely
export function parseOutcomePrices(pricesStr?: string): number[] {
  if (!pricesStr) return [0.5, 0.5];
  try {
    const parsed = JSON.parse(pricesStr);
    return parsed.map((p: string | number) => parseFloat(String(p)));
  } catch {
    return [0.5, 0.5];
  }
}

// Parse outcomes safely
export function parseOutcomes(outcomesStr?: string): string[] {
  if (!outcomesStr) return ["Yes", "No"];
  try {
    return JSON.parse(outcomesStr);
  } catch {
    return ["Yes", "No"];
  }
}

// Format volume/liquidity
export function formatVolume(n?: number): string {
  if (!n) return "$0";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}
