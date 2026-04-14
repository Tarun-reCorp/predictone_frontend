# PredictOne - High-Level Design (HLD)

**Version:** 1.0  
**Date:** April 8, 2026  
**Document Owner:** Engineering Team  
**Status:** Approved for Implementation

---

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Component Diagrams](#component-diagrams)
3. [Data Flow Diagrams](#data-flow-diagrams)
4. [Sequence Diagrams](#sequence-diagrams)
5. [Database Design](#database-design)
6. [API Design](#api-design)
7. [Security Design](#security-design)
8. [Deployment Architecture](#deployment-architecture)

---

## System Architecture

### 1.1 Overview

PredictOne follows a **serverless, edge-first architecture** built on Next.js 16 with the App Router. All application logic runs on Vercel's edge network for global low-latency access.

### 1.2 Architectural Style

- **Frontend:** Server-Side Rendering (SSR) + Client-Side Hydration
- **Backend:** Serverless Functions (API Routes)
- **Data Layer:** External APIs (Polymarket, FRED) with client-side caching
- **Deployment:** Vercel Edge Network (CDN + Serverless Functions)

### 1.3 High-Level Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│                            CLIENT TIER                                │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  Web Browser (Desktop, Mobile, Tablet)                         │  │
│  │  - React 19 + Next.js 16 App Router                            │  │
│  │  - Tailwind CSS for styling                                    │  │
│  │  - Recharts for data visualization                             │  │
│  └────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
                                  ▲
                                  │ HTTPS (TLS 1.3)
                                  ▼
┌──────────────────────────────────────────────────────────────────────┐
│                       VERCEL EDGE NETWORK                             │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  CDN Layer (Static Assets, Images, Fonts)                      │  │
│  │  - Global edge caching (200+ PoPs)                             │  │
│  │  - Automatic image optimization                                │  │
│  └────────────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  Compute Layer (Serverless Functions)                          │  │
│  │  - Server Components (SSR)                                     │  │
│  │  - API Routes (Proxy Layer)                                    │  │
│  │  - Auto-scaling (0 to ∞)                                       │  │
│  └────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
                                  ▲
                                  │ Server-Side Fetch
                                  ▼
┌──────────────────────────────────────────────────────────────────────┐
│                       EXTERNAL DATA SOURCES                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                  │
│  │ Polymarket  │  │ Polymarket  │  │    FRED     │                  │
│  │ Gamma API   │  │  CLOB API   │  │  (St. Louis │                  │
│  │ (Markets)   │  │ (Orderbook) │  │     Fed)    │                  │
│  └─────────────┘  └─────────────┘  └─────────────┘                  │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Component Diagrams

### 2.1 Frontend Component Hierarchy

```
App (layout.tsx)
│
├── Header
│   ├── Logo
│   ├── Search
│   ├── Navigation Tabs
│   └── User Actions (Connect Wallet, Admin, Simulate)
│
├── Pages
│   │
│   ├── Homepage (/)
│   │   ├── LeftSidebar
│   │   │   ├── BreakingNews
│   │   │   ├── CommunityComments
│   │   │   └── Watchlist
│   │   ├── MainContent
│   │   │   ├── FeaturedMarket
│   │   │   │   ├── PriceChart (Recharts)
│   │   │   │   └── TradePanel
│   │   │   └── MarketsFeed
│   │   │       └── MarketCard (×40)
│   │   └── RightSidebar
│   │       ├── MarketPulse
│   │       ├── EconPanel (FRED)
│   │       ├── TraderLeaderboard
│   │       └── HotTopics
│   │
│   ├── MarketDetail (/market/[id])
│   │   ├── BackButton
│   │   ├── MarketHeader
│   │   ├── FeaturedMarket (Full Chart)
│   │   ├── OrderBook
│   │   ├── MarketStats
│   │   ├── Tags
│   │   └── RelatedMarkets
│   │
│   ├── Economics (/economics)
│   │   ├── IndicatorGrid
│   │   │   └── IndicatorCard (×12)
│   │   ├── DetailPanel
│   │   │   └── LineChart (Recharts)
│   │   └── QuickSummary
│   │
│   ├── Simulation (/simulate)
│   │   ├── ControlPanel
│   │   ├── MarketGrid
│   │   ├── DetailPanel
│   │   └── ActivityLog
│   │
│   └── Admin (/admin)
│       ├── AdminLayout
│       │   ├── Sidebar
│       │   └── TopBar
│       ├── Overview
│       ├── Markets
│       ├── Trades
│       ├── Economics
│       ├── Simulation
│       └── Settings
│
└── Footer (future)
```

### 2.2 Backend Component Diagram

```
API Routes Layer
│
├── /api/markets (Gamma Proxy)
│   └── GET → Polymarket Gamma API
│
├── /api/events (Gamma Proxy)
│   └── GET → Polymarket Gamma API
│
├── /api/prices (CLOB Proxy)
│   └── GET → Polymarket CLOB API
│
├── /api/clob (CLOB Multi-Endpoint Proxy)
│   ├── GET ?endpoint=book → Orderbook
│   ├── GET ?endpoint=midpoints → Midpoints
│   └── GET ?endpoint=spreads → Spreads
│
├── /api/leaderboard (Data Proxy)
│   └── GET → Polymarket Data API
│
└── /api/fred
    ├── /series → Single FRED series
    └── /bulk → Multiple FRED series
```

---

## Data Flow Diagrams

### 3.1 Market Discovery Data Flow

```
┌─────────┐
│  User   │
└────┬────┘
     │ 1. Visit homepage
     ▼
┌─────────────────┐
│  Browser (RSC)  │ 2. Server pre-renders page
└────┬────────────┘
     │ 3. useEffect calls clientFetchMarkets()
     ▼
┌──────────────────┐
│ /api/markets     │ 4. Proxy route receives request
└────┬─────────────┘
     │ 5. Fetch with query params
     ▼
┌──────────────────────────┐
│ Polymarket Gamma API     │ 6. Returns JSON
│ /markets?limit=40&...    │
└────┬─────────────────────┘
     │ 7. Response (PolyMarket[])
     ▼
┌──────────────────┐
│ /api/markets     │ 8. Add cache headers
└────┬─────────────┘
     │ 9. JSON response
     ▼
┌─────────────────┐
│ Browser         │ 10. setMarkets(data)
└────┬────────────┘
     │ 11. Re-render MarketsFeed
     ▼
┌─────────────────┐
│ MarketCard (×40)│ 12. Display markets
└─────────────────┘
```

### 3.2 Price History Data Flow

```
┌─────────┐
│  User   │ 1. Click market card
└────┬────┘
     │ 2. Navigate /market/{slug}
     ▼
┌─────────────────┐
│ Server Component│ 3. await fetchMarketById(slug)
│ (market/[id])   │ 4. await fetchPriceHistory(conditionId)
└────┬────────────┘
     │ 5. Server-side fetch
     ▼
┌──────────────────────────┐
│ Polymarket CLOB API      │ 6. GET /prices-history?market=0x...
│                          │
└────┬─────────────────────┘
     │ 7. { history: [{ t, p }] }
     ▼
┌─────────────────┐
│ Server Component│ 8. Pass to FeaturedMarket
└────┬────────────┘
     │ 9. Render with data
     ▼
┌─────────────────┐
│ FeaturedMarket  │ 10. <AreaChart data={priceHistory} />
└─────────────────┘
```

### 3.3 Economic Indicator Data Flow

```
┌─────────┐
│  User   │ 1. Open EconPanel
└────┬────┘
     │ 2. Component mounts
     ▼
┌─────────────────┐
│ EconPanel       │ 3. useEffect → fetch()
└────┬────────────┘
     │ 4. GET /api/fred/bulk?series=GDP,UNRATE,...
     ▼
┌──────────────────┐
│ /api/fred/bulk   │ 5. Loop series IDs
└────┬─────────────┘
     │ 6. Parallel fetch × 6
     ▼
┌─────────────────────────────┐
│ FRED API                    │ 7. Multiple requests
│ /series/observations?...    │
└────┬────────────────────────┘
     │ 8. Observations array per series
     ▼
┌──────────────────┐
│ /api/fred/bulk   │ 9. Aggregate { [id]: data }
└────┬─────────────┘
     │ 10. JSON response
     ▼
┌─────────────────┐
│ EconPanel       │ 11. setIndicators(data)
└────┬────────────┘
     │ 12. Render cards
     ▼
┌─────────────────┐
│ IndicatorCard   │ 13. Display sparkline + value
└─────────────────┘
```

---

## Sequence Diagrams

### 4.1 User Views Market Detail

```
User        Browser      Server      Gamma API   CLOB API
 │             │            │            │           │
 │─ Click ────▶│            │            │           │
 │             │─ Navigate to /market/us-election-2024 │
 │             │            │            │           │
 │             │───────────▶│ SSR Start  │           │
 │             │            │            │           │
 │             │            │─ fetchMarketById("us-election-2024")
 │             │            │───────────▶│           │
 │             │            │            │◀─ Market data
 │             │            │◀───────────│           │
 │             │            │            │           │
 │             │            │─ fetchPriceHistory(conditionId)
 │             │            │──────────────────────▶│
 │             │            │            │           │◀─ Price history
 │             │            │◀──────────────────────│
 │             │            │            │           │
 │             │◀───────────│ HTML + data│           │
 │◀────────────│            │            │           │
 │             │            │            │           │
 │─ View ─────▶│            │            │           │
```

### 4.2 Admin Views Trade Activity

```
Admin       Browser      /api/prices   CLOB API
 │             │            │              │
 │─ Visit /admin/trades   │              │
 │             │            │              │
 │             │◀─ Page loads with simulation
 │             │            │              │
 │             │─ useEffect starts interval
 │             │            │              │
 │             │─ Select market dropdown   │
 │             │            │              │
 │             │─ fetch("/api/prices?market=0x...")
 │             │───────────▶│              │
 │             │            │─ Proxy ─────▶│
 │             │            │              │◀─ History
 │             │            │◀─────────────│
 │             │◀───────────│              │
 │             │            │              │
 │             │─ Render LineChart         │
```

---

## Database Design

### 5.1 Current State

**No database** - all data fetched from external APIs in real-time.

### 5.2 Proposed Schema (Future)

#### Users Table

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE,
  username VARCHAR(50) UNIQUE,
  password_hash VARCHAR(255),
  wallet_address VARCHAR(42) UNIQUE,
  role VARCHAR(20) DEFAULT 'user', -- 'user', 'admin'
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_wallet ON users(wallet_address);
```

#### Portfolios Table

```sql
CREATE TABLE portfolios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  market_id VARCHAR(100) NOT NULL, -- Polymarket conditionId
  outcome VARCHAR(50) NOT NULL, -- 'Yes' or 'No'
  shares DECIMAL(18,8) NOT NULL,
  avg_price DECIMAL(18,8) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, market_id, outcome)
);

CREATE INDEX idx_portfolios_user ON portfolios(user_id);
CREATE INDEX idx_portfolios_market ON portfolios(market_id);
```

#### Trades Table

```sql
CREATE TABLE trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  market_id VARCHAR(100) NOT NULL,
  side VARCHAR(10) NOT NULL, -- 'buy', 'sell'
  outcome VARCHAR(50) NOT NULL,
  shares DECIMAL(18,8) NOT NULL,
  price DECIMAL(18,8) NOT NULL,
  total DECIMAL(18,8) NOT NULL,
  fee DECIMAL(18,8) DEFAULT 0,
  executed_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_trades_user ON trades(user_id);
CREATE INDEX idx_trades_market ON trades(market_id);
CREATE INDEX idx_trades_executed ON trades(executed_at DESC);
```

#### Watchlists Table

```sql
CREATE TABLE watchlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  market_id VARCHAR(100) NOT NULL,
  added_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, market_id)
);

CREATE INDEX idx_watchlists_user ON watchlists(user_id);
```

#### Price Alerts Table

```sql
CREATE TABLE price_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  market_id VARCHAR(100) NOT NULL,
  outcome VARCHAR(50) NOT NULL,
  target_price DECIMAL(18,8) NOT NULL,
  condition VARCHAR(10) NOT NULL, -- 'above', 'below'
  triggered BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  triggered_at TIMESTAMP
);

CREATE INDEX idx_alerts_user ON price_alerts(user_id);
CREATE INDEX idx_alerts_active ON price_alerts(triggered) WHERE triggered = FALSE;
```

### 5.3 Entity-Relationship Diagram

```
┌──────────┐         ┌──────────────┐
│  users   │◀────────│  portfolios  │
│          │ 1     * │              │
│  - id    │         │  - user_id   │
│  - email │         │  - market_id │
│  - role  │         │  - shares    │
└────┬─────┘         └──────────────┘
     │
     │ 1
     │
     │ *
┌────▼─────┐         ┌──────────────┐
│  trades  │         │  watchlists  │
│          │         │              │
│  - id    │         │  - user_id   │
│  - user  │         │  - market_id │
│  - side  │         └──────────────┘
└──────────┘
```

---

## API Design

### 6.1 Internal API Endpoints

#### GET /api/markets

**Description:** Fetch list of prediction markets

**Query Parameters:**
- `limit` (number): Max results (default: 20)
- `offset` (number): Pagination offset (default: 0)
- `active` (boolean): Filter active markets
- `tag_slug` (string): Filter by category
- `order` (string): Sort field (volume, liquidity)
- `ascending` (boolean): Sort direction

**Response:**
```json
[
  {
    "id": "12345",
    "conditionId": "0x...",
    "slug": "us-election-2024",
    "question": "Who will win the 2024 US Election?",
    "image": "https://...",
    "volume": "1234567.89",
    "liquidity": "987654.32",
    "outcomes": ["Yes", "No"],
    "outcomePrices": ["0.67", "0.33"],
    "endDate": "2024-11-05T00:00:00Z",
    "active": true
  }
]
```

---

#### GET /api/prices

**Description:** Fetch price history for a market

**Query Parameters:**
- `market` (string): conditionId (required)
- `interval` (string): Time interval (1h, 1d, 1w, 1m)
- `fidelity` (number): Data points (default: 60)

**Response:**
```json
{
  "history": [
    { "t": 1704067200, "p": 0.65 },
    { "t": 1704153600, "p": 0.67 }
  ]
}
```

---

#### GET /api/fred/bulk

**Description:** Fetch multiple FRED economic series

**Query Parameters:**
- `series` (string): Comma-separated series IDs (e.g., "GDP,UNRATE,CPIAUCSL")

**Response:**
```json
{
  "GDP": {
    "value": 27000.5,
    "date": "2026-01-01",
    "change": 2.3,
    "unit": "Billions of Dollars"
  },
  "UNRATE": {
    "value": 3.8,
    "date": "2026-03-01",
    "change": -0.2,
    "unit": "Percent"
  }
}
```

---

### 6.2 Future API Endpoints (User Features)

#### POST /api/auth/register

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "username": "trader_alice"
}
```

**Response:**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "username": "trader_alice"
  },
  "token": "jwt_token_here"
}
```

---

#### POST /api/trades

**Request:**
```json
{
  "market_id": "0x123...",
  "side": "buy",
  "outcome": "Yes",
  "shares": 10,
  "price": 0.67
}
```

**Response:**
```json
{
  "trade": {
    "id": "uuid",
    "executed_at": "2026-04-08T12:00:00Z",
    "total": 6.70,
    "fee": 0.034
  }
}
```

---

## Security Design

### 7.1 Threat Model

| Threat | Attack Vector | Mitigation |
|--------|--------------|-----------|
| **API Key Exposure** | Client-side code inspection | Store keys in server-side env vars only |
| **CORS Bypass** | Direct external API calls | Proxy all external calls through Next.js API routes |
| **SQL Injection** | User input in queries | Use parameterized queries (Prisma/Drizzle) |
| **XSS** | Malicious user-generated content | Sanitize inputs, use React auto-escaping |
| **CSRF** | Forged requests | Use CSRF tokens, SameSite cookies |
| **DDoS** | High traffic volume | Vercel DDoS protection, rate limiting |

### 7.2 Security Layers

```
┌────────────────────────────────────────┐
│  Layer 1: Network Security             │
│  - HTTPS/TLS 1.3 enforced              │
│  - DDoS protection (Vercel)            │
│  - Firewall rules (Edge Functions)     │
└────────────────────────────────────────┘
┌────────────────────────────────────────┐
│  Layer 2: Application Security         │
│  - Input validation (Zod schemas)      │
│  - Output encoding (React auto-escape) │
│  - CSRF tokens                         │
└────────────────────────────────────────┘
┌────────────────────────────────────────┐
│  Layer 3: Authentication & Authorization│
│  - JWT-based sessions (future)         │
│  - Role-based access control (RBAC)    │
│  - Admin routes protected              │
└────────────────────────────────────────┘
┌────────────────────────────────────────┐
│  Layer 4: Data Security                │
│  - API keys in server env vars         │
│  - Password hashing (bcrypt)           │
│  - Database encryption at rest         │
└────────────────────────────────────────┘
```

---

## Deployment Architecture

### 8.1 Current Deployment

```
GitHub Repository (main branch)
  │
  │ git push
  ▼
┌─────────────────────────────┐
│  Vercel Build Pipeline      │
│  1. Install deps (pnpm)     │
│  2. TypeScript check        │
│  3. Next.js build           │
│  4. Generate static pages   │
└─────────────────────────────┘
  │
  │ Deploy
  ▼
┌─────────────────────────────┐
│  Vercel Edge Network        │
│  - 200+ PoPs globally       │
│  - Automatic HTTPS          │
│  - HTTP/2, HTTP/3           │
│  - DDoS protection          │
└─────────────────────────────┘
  │
  │ Route request
  ▼
┌─────────────────────────────┐
│  Serverless Functions       │
│  - Auto-scale 0 to ∞        │
│  - 10s timeout (Hobby)      │
│  - Node.js 20 runtime       │
└─────────────────────────────┘
```

### 8.2 Multi-Environment Strategy

| Environment | Branch | Domain | Purpose |
|-------------|--------|--------|---------|
| **Production** | `main` | `predictone.com` | Live users |
| **Staging** | `staging` | `staging.predictone.com` | Pre-release testing |
| **Preview** | `feature/*` | `{hash}.vercel.app` | PR previews |
| **Development** | `dev` | `dev.predictone.com` | Internal dev |

### 8.3 Rollback Strategy

1. **Instant Rollback:**
   - Vercel UI → Deployments → Previous version → Promote

2. **Git Revert:**
   ```bash
   git revert HEAD
   git push origin main
   ```

3. **Feature Flags:**
   - Use Vercel Edge Config for gradual rollouts
   - Toggle features without redeployment

---

## Appendix

### A. Technology Decision Matrix

| Decision | Options Considered | Choice | Rationale |
|----------|-------------------|--------|-----------|
| **Frontend Framework** | Next.js, Remix, Gatsby | Next.js 16 | Best RSC support, Vercel integration |
| **Styling** | Tailwind, CSS Modules, styled-components | Tailwind CSS v4 | Fastest development, smallest bundle |
| **Charts** | Recharts, Chart.js, D3 | Recharts | Declarative, React-native, good docs |
| **State Management** | Redux, Zustand, SWR | SWR (future) | Simple, auto-refetch, cache |
| **Deployment** | Vercel, Netlify, AWS | Vercel | Native Next.js support, edge functions |

### B. Performance Benchmarks

| Metric | Target | Current |
|--------|--------|---------|
| **First Contentful Paint (FCP)** | <1.5s | 0.8s ✅ |
| **Largest Contentful Paint (LCP)** | <2.5s | 1.9s ✅ |
| **Time to Interactive (TTI)** | <3.5s | 2.7s ✅ |
| **Cumulative Layout Shift (CLS)** | <0.1 | 0.03 ✅ |
| **First Input Delay (FID)** | <100ms | 45ms ✅ |

---

**Document Owner:** Engineering Team  
**Review Cycle:** Quarterly  
**Next Review:** July 8, 2026
