// PredictOne Simulation Engine
// Generates synthetic markets and simulates live trading activity using
// a random-walk model with momentum, mean-reversion, and event shocks.

export interface SimMarket {
  id: string;
  question: string;
  category: string;
  icon: string;
  startPrice: number;       // initial Yes probability 0-1
  currentPrice: number;     // live Yes probability
  volume: number;           // total $
  liquidity: number;
  traders: number;
  endDate: string;
  history: { t: number; p: number }[];
  trades: SimTrade[];
  status: "active" | "resolved";
  resolution?: "Yes" | "No";
  tags: string[];
  description: string;
}

export interface SimTrade {
  id: string;
  side: "Yes" | "No";
  size: number;
  price: number;
  trader: string;
  ts: number;
}

export interface SimPortfolio {
  balance: number;
  positions: Record<string, { side: "Yes" | "No"; shares: number; avgPrice: number }>;
  pnl: number;
  trades: SimTrade[];
}

// ─── Market Templates ────────────────────────────────────────────────────────

const MARKET_TEMPLATES = [
  // Politics
  { q: "Will the US Federal Reserve cut rates before July 2026?", cat: "politics", icon: "🏛️", desc: "The Fed meets six times in H1 2026. Traders are watching CPI closely.", tags: ["economics", "fed", "rates"], bias: 0.55 },
  { q: "Will NATO expand to include a new member in 2026?", cat: "politics", icon: "🌍", desc: "Several nations are in accession talks. Unanimous approval needed.", tags: ["geopolitics", "nato"], bias: 0.28 },
  { q: "Will there be a snap election in the UK in 2026?", cat: "politics", icon: "🇬🇧", desc: "PM's approval ratings have dropped sharply amid economic pressures.", tags: ["uk", "election"], bias: 0.35 },
  { q: "Will India's GDP growth exceed 7% in FY2026?", cat: "economy", icon: "🇮🇳", desc: "IMF projects 6.8%. Strong domestic consumption is a bullish signal.", tags: ["india", "gdp"], bias: 0.62 },
  // Crypto
  { q: "Will Bitcoin reach $120,000 before end of 2026?", cat: "crypto", icon: "₿", desc: "Institutional inflows and ETF demand are accelerating the bull cycle.", tags: ["bitcoin", "btc"], bias: 0.58 },
  { q: "Will Ethereum surpass $8,000 in 2026?", cat: "crypto", icon: "Ξ", desc: "ETH staking yields and L2 activity have been growing rapidly.", tags: ["ethereum", "eth"], bias: 0.45 },
  { q: "Will a spot Solana ETF be approved in the US in 2026?", cat: "crypto", icon: "◎", desc: "Following Bitcoin and Ethereum ETF approvals, Solana is next in line.", tags: ["solana", "etf"], bias: 0.52 },
  { q: "Will a major exchange be hacked for >$500M in 2026?", cat: "crypto", icon: "🔐", desc: "Security incidents are becoming more sophisticated. DeFi remains a target.", tags: ["security", "defi"], bias: 0.18 },
  // Sports
  { q: "Will Manchester City win the Premier League 2025/26?", cat: "sports", icon: "⚽", desc: "City are 3 points ahead with 8 games remaining. Pep's squad depth is unmatched.", tags: ["football", "epl"], bias: 0.68 },
  { q: "Will Novak Djokovic win any Grand Slam in 2026?", cat: "sports", icon: "🎾", desc: "Djokovic is fit again after a knee operation. Paris and Wimbledon are his targets.", tags: ["tennis", "djokovic"], bias: 0.42 },
  { q: "Will the Golden State Warriors make the NBA playoffs in 2026?", cat: "sports", icon: "🏀", desc: "Curry is healthy but the West is deeply competitive this year.", tags: ["nba", "basketball"], bias: 0.38 },
  // Tech/AI
  { q: "Will GPT-5 be released publicly before June 2026?", cat: "ai", icon: "🤖", desc: "OpenAI has been tight-lipped but insiders suggest training is complete.", tags: ["openai", "gpt", "ai"], bias: 0.72 },
  { q: "Will Apple release an AR/VR headset successor in 2026?", cat: "tech", icon: "🥽", desc: "Vision Pro sales disappointed. Apple is reportedly working on a lighter model.", tags: ["apple", "arvr"], bias: 0.55 },
  { q: "Will a humanoid robot be deployed at scale (>10,000 units) in 2026?", cat: "tech", icon: "🦾", desc: "Tesla Optimus and Figure AI are in production. Orders from automotive sector are rising.", tags: ["robotics", "tesla"], bias: 0.44 },
  { q: "Will there be a major AI regulation law in the EU or US in 2026?", cat: "ai", icon: "⚖️", desc: "The EU AI Act is being phased in. US Congress has several bills in committee.", tags: ["regulation", "ai"], bias: 0.61 },
  // Science
  { q: "Will NASA's Artemis III moon landing happen before 2027?", cat: "science", icon: "🌕", desc: "Multiple delays have pushed timelines back. SpaceX Starship is the key dependency.", tags: ["nasa", "space"], bias: 0.31 },
  { q: "Will a new antibiotic class be approved by the FDA in 2026?", cat: "science", icon: "🧬", desc: "AMR is a WHO priority. Several pipeline candidates are in Phase III trials.", tags: ["health", "fda"], bias: 0.22 },
  // Economy
  { q: "Will US unemployment exceed 5% in 2026?", cat: "economy", icon: "📊", desc: "Labor market has shown surprising resilience but AI-related layoffs are accelerating.", tags: ["us", "unemployment"], bias: 0.34 },
  { q: "Will the S&P 500 hit 7,000 in 2026?", cat: "economy", icon: "📈", desc: "Strong earnings season and rate cut expectations are fueling a rally.", tags: ["stocks", "sp500"], bias: 0.63 },
];

const TRADER_NAMES = [
  "alpha_wolf", "whale_01", "degenerate_iq", "polymaxi", "predictoor",
  "stat_arb", "bayesian_bet", "edge_seeker", "vol_trader", "mkt_maker",
  "contrarian_99", "quant_fox", "signal_noise", "risk_on_off", "dao_trader",
];

function randomId() {
  return Math.random().toString(36).slice(2, 10);
}

function randomTrader() {
  return TRADER_NAMES[Math.floor(Math.random() * TRADER_NAMES.length)];
}

function daysFromNow(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

// Build initial price history (last 30 days)
function buildInitialHistory(startPrice: number): { t: number; p: number }[] {
  const now = Date.now();
  const points: { t: number; p: number }[] = [];
  let p = startPrice + (Math.random() - 0.5) * 0.2;
  p = Math.max(0.05, Math.min(0.95, p));
  const step = (24 * 60 * 60 * 1000); // 1 day
  for (let i = 29; i >= 0; i--) {
    const drift = (startPrice - p) * 0.05; // mean reversion
    const shock = (Math.random() - 0.5) * 0.04;
    p = Math.max(0.03, Math.min(0.97, p + drift + shock));
    points.push({ t: Math.floor((now - i * step) / 1000), p: parseFloat(p.toFixed(3)) });
  }
  return points;
}

// Generate a fresh set of simulated markets
export function generateSimMarkets(count = 12): SimMarket[] {
  const shuffled = [...MARKET_TEMPLATES].sort(() => Math.random() - 0.5).slice(0, count);
  return shuffled.map((t, i) => {
    const startPrice = t.bias + (Math.random() - 0.5) * 0.15;
    const clampedStart = Math.max(0.05, Math.min(0.95, startPrice));
    const history = buildInitialHistory(clampedStart);
    const currentPrice = history[history.length - 1].p;
    return {
      id: `sim-${i}-${randomId()}`,
      question: t.q,
      category: t.cat,
      icon: t.icon,
      startPrice: clampedStart,
      currentPrice,
      volume: Math.floor(Math.random() * 900_000 + 50_000),
      liquidity: Math.floor(Math.random() * 200_000 + 20_000),
      traders: Math.floor(Math.random() * 3000 + 100),
      endDate: daysFromNow(Math.floor(Math.random() * 180 + 30)),
      history,
      trades: generateInitialTrades(currentPrice),
      status: "active",
      tags: t.tags,
      description: t.desc,
    };
  });
}

function generateInitialTrades(price: number): SimTrade[] {
  const trades: SimTrade[] = [];
  const now = Date.now();
  for (let i = 0; i < 8; i++) {
    const p = Math.max(0.03, Math.min(0.97, price + (Math.random() - 0.5) * 0.06));
    trades.push({
      id: randomId(),
      side: Math.random() > 0.5 ? "Yes" : "No",
      size: Math.floor(Math.random() * 2000 + 50),
      price: parseFloat(p.toFixed(3)),
      trader: randomTrader(),
      ts: Math.floor((now - (8 - i) * 60_000 * Math.random() * 10) / 1000),
    });
  }
  return trades;
}

// ─── Tick Engine ─────────────────────────────────────────────────────────────
// Call this on an interval to advance the simulation by one tick.

export function tickMarket(market: SimMarket): SimMarket {
  if (market.status === "resolved") return market;

  const last = market.currentPrice;
  const bias = market.startPrice; // mean-revert toward original bias
  const meanRevStrength = 0.03;
  const momentum = market.history.length >= 2
    ? (market.history[market.history.length - 1].p - market.history[market.history.length - 2].p) * 0.3
    : 0;
  const drift = (bias - last) * meanRevStrength;
  const noise = (Math.random() - 0.5) * 0.025;
  // Occasional larger event shock
  const shock = Math.random() < 0.05 ? (Math.random() - 0.5) * 0.08 : 0;
  const newPrice = Math.max(0.02, Math.min(0.98, last + drift + momentum + noise + shock));
  const p = parseFloat(newPrice.toFixed(3));

  const now = Math.floor(Date.now() / 1000);
  const newHistory = [...market.history, { t: now, p }];
  // Keep last 500 ticks
  if (newHistory.length > 500) newHistory.shift();

  // Generate 0-2 trades this tick
  const newTrades: SimTrade[] = [];
  const tradeCount = Math.random() < 0.6 ? 1 : Math.random() < 0.3 ? 2 : 0;
  for (let i = 0; i < tradeCount; i++) {
    const tradeSide: "Yes" | "No" = Math.random() > (1 - p) ? "Yes" : "No";
    const tradePrice = tradeSide === "Yes" ? p : parseFloat((1 - p).toFixed(3));
    const size = Math.floor(Math.random() * 2500 + 25);
    newTrades.push({
      id: randomId(),
      side: tradeSide,
      size,
      price: tradePrice,
      trader: randomTrader(),
      ts: now,
    });
  }

  const allTrades = [...market.trades, ...newTrades].slice(-50);
  const addedVolume = newTrades.reduce((s, t) => s + t.size, 0);

  return {
    ...market,
    currentPrice: p,
    history: newHistory,
    trades: allTrades,
    volume: market.volume + addedVolume,
    traders: market.traders + (Math.random() < 0.1 ? 1 : 0),
  };
}

// ─── Portfolio helpers ────────────────────────────────────────────────────────

export function createPortfolio(): SimPortfolio {
  return { balance: 1000, positions: {}, pnl: 0, trades: [] };
}

export function placeTrade(
  portfolio: SimPortfolio,
  market: SimMarket,
  side: "Yes" | "No",
  amount: number
): { portfolio: SimPortfolio; error?: string } {
  if (amount <= 0) return { portfolio, error: "Amount must be positive" };
  if (amount > portfolio.balance) return { portfolio, error: "Insufficient balance" };

  const price = side === "Yes" ? market.currentPrice : 1 - market.currentPrice;
  const shares = parseFloat((amount / price).toFixed(4));
  const trade: SimTrade = {
    id: randomId(),
    side,
    size: amount,
    price,
    trader: "you",
    ts: Math.floor(Date.now() / 1000),
  };

  const existing = portfolio.positions[market.id];
  let newPosition;
  if (existing && existing.side === side) {
    const totalCost = existing.shares * existing.avgPrice + amount;
    const totalShares = existing.shares + shares;
    newPosition = { side, shares: totalShares, avgPrice: totalCost / totalShares };
  } else {
    newPosition = { side, shares, avgPrice: price };
  }

  return {
    portfolio: {
      ...portfolio,
      balance: parseFloat((portfolio.balance - amount).toFixed(2)),
      positions: { ...portfolio.positions, [market.id]: newPosition },
      trades: [...portfolio.trades, trade],
    },
  };
}

export function calcPortfolioPnL(portfolio: SimPortfolio, markets: SimMarket[]): number {
  let pnl = 0;
  for (const [marketId, pos] of Object.entries(portfolio.positions)) {
    const market = markets.find((m) => m.id === marketId);
    if (!market) continue;
    const currentPrice = pos.side === "Yes" ? market.currentPrice : 1 - market.currentPrice;
    pnl += pos.shares * (currentPrice - pos.avgPrice);
  }
  return parseFloat(pnl.toFixed(2));
}

export function formatSimVolume(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}
