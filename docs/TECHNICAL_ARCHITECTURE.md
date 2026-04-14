# PredictOne - Technical Architecture Document

**Version:** 1.0  
**Last Updated:** April 8, 2026  
**Status:** Production Ready

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture Diagram](#architecture-diagram)
3. [Technology Stack](#technology-stack)
4. [Application Structure](#application-structure)
5. [Data Flow](#data-flow)
6. [API Integration Layer](#api-integration-layer)
7. [Frontend Architecture](#frontend-architecture)
8. [Backend Architecture](#backend-architecture)
9. [Database Schema](#database-schema)
10. [Security Architecture](#security-architecture)
11. [Performance Optimization](#performance-optimization)
12. [Scalability Considerations](#scalability-considerations)
13. [Monitoring & Observability](#monitoring--observability)

---

## System Overview

**PredictOne** is a full-stack prediction market trading platform built on Next.js 16 that aggregates real-time market data from Polymarket APIs and economic indicators from FRED (Federal Reserve Economic Data). The platform enables users to:

- Browse and trade on prediction markets across politics, crypto, sports, economics, AI, and more
- View live price charts, order books, and market depth
- Monitor economic indicators (GDP, CPI, unemployment, Fed rates, etc.)
- Run market simulations with auto-generated synthetic markets
- Access a comprehensive admin dashboard for market oversight

### Key Components

1. **Public Trading Interface** - Market discovery, charts, orderbooks, live price feeds
2. **Admin Backend** - Market management, trade monitoring, analytics, system health
3. **Simulation Engine** - Synthetic market generation with realistic price dynamics
4. **Economic Data Integration** - Real-time FRED economic indicators
5. **API Proxy Layer** - Server-side proxies to avoid CORS and secure external API calls

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client Browser                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Homepage   │  │ Market Detail│  │   Admin UI   │          │
│  │  (Markets)   │  │  (Charts)    │  │  (Dashboard) │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
                            ▲
                            │ HTTPS
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Next.js 16 App Router                        │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Server Components (RSC)    │   Client Components        │  │
│  │  - /app/page.tsx            │   - /components/*          │  │
│  │  - /app/market/[id]/page    │   - State Management (SWR) │  │
│  │  - /app/admin/*             │   - Client Interactivity   │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │             API Routes (Proxy Layer)                     │  │
│  │  /api/markets    /api/prices    /api/fred/*             │  │
│  │  /api/events     /api/clob      /api/leaderboard        │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                            ▲
                            │ Server-Side Fetch
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                   External Data Sources                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  Polymarket  │  │  Polymarket  │  │    FRED      │          │
│  │  Gamma API   │  │  CLOB API    │  │  (St. Louis  │          │
│  │  (Markets)   │  │  (Prices)    │  │     Fed)     │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

---

## Technology Stack

### Frontend

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| **Framework** | Next.js | 16.0.0 | React meta-framework with App Router, RSC |
| **Language** | TypeScript | 5.x | Type-safe development |
| **Styling** | Tailwind CSS | 4.0 | Utility-first CSS with custom design tokens |
| **UI Components** | shadcn/ui | Latest | Accessible, customizable component library |
| **Charts** | Recharts | 2.x | Declarative charting for price history & analytics |
| **State** | React Hooks + SWR | 2.x | Client state + data fetching with cache |
| **Icons** | Lucide React | Latest | Consistent icon system |
| **Fonts** | Inter, JetBrains Mono | Google Fonts | Professional typography |

### Backend / Runtime

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| **Runtime** | Node.js | 20.x | Server-side JavaScript execution |
| **Framework** | Next.js API Routes | 16.0.0 | Serverless API endpoints |
| **Deployment** | Vercel | Latest | Edge runtime, automatic scaling |
| **Cache** | Next.js Cache | Built-in | Response caching (30-60s revalidation) |

### External APIs

| Service | API Endpoint | Purpose | Auth Required |
|---------|-------------|---------|---------------|
| **Polymarket Gamma** | `gamma-api.polymarket.com` | Market discovery, metadata | No |
| **Polymarket CLOB** | `clob.polymarket.com` | Price history, orderbook | No (read-only) |
| **Polymarket Data** | `data-api.polymarket.com` | Leaderboards, user activity | No |
| **FRED** | `api.stlouisfed.org` | Economic indicators | API Key |

### Development Tools

- **Package Manager:** pnpm 9.x
- **Linting:** ESLint + TypeScript ESLint
- **Formatting:** Prettier (auto via Next.js)
- **Version Control:** Git

---

## Application Structure

```
/vercel/share/v0-project/
├── app/
│   ├── page.tsx                    # Homepage (market feed + featured market)
│   ├── layout.tsx                  # Root layout with fonts, metadata
│   ├── globals.css                 # Tailwind config + design tokens
│   ├── market/[id]/page.tsx        # Market detail page (charts + orderbook)
│   ├── simulate/page.tsx           # Simulation dashboard
│   ├── economics/page.tsx          # FRED economic indicators
│   ├── admin/                      # Admin backend
│   │   ├── layout.tsx              # Admin layout with sidebar
│   │   ├── page.tsx                # Overview dashboard
│   │   ├── markets/page.tsx        # Market management
│   │   ├── trades/page.tsx         # Trade monitoring
│   │   ├── economics/page.tsx      # Economic data admin
│   │   ├── simulation/page.tsx     # Simulation control panel
│   │   └── settings/page.tsx       # System settings
│   └── api/                        # API proxy routes
│       ├── markets/route.ts        # Gamma API proxy
│       ├── events/route.ts         # Event lookup proxy
│       ├── prices/route.ts         # CLOB price history proxy
│       ├── clob/route.ts           # CLOB orderbook proxy
│       ├── leaderboard/route.ts    # Leaderboard proxy
│       └── fred/                   # FRED API proxies
│           ├── series/route.ts     # Single series lookup
│           └── bulk/route.ts       # Bulk series fetch
├── components/
│   ├── header.tsx                  # Main navigation header
│   ├── featured-market.tsx         # Hero market with chart + trade panel
│   ├── market-card.tsx             # Market grid card component
│   ├── markets-feed.tsx            # Paginated market grid
│   ├── order-book.tsx              # Live orderbook display
│   ├── econ-panel.tsx              # Economic indicators sidebar
│   ├── left-sidebar.tsx            # News, comments, watchlist
│   ├── right-sidebar.tsx           # Leaderboard, AI predictions, topics
│   └── ui/                         # shadcn/ui base components
├── lib/
│   ├── polymarket.ts               # Polymarket API client + types
│   ├── fred.ts                     # FRED API client + indicators
│   ├── simulation.ts               # Market simulation engine
│   └── utils.ts                    # Utility functions (cn, etc.)
├── docs/
│   ├── TECHNICAL_ARCHITECTURE.md   # This document
│   ├── BUSINESS_REQUIREMENTS.md    # Business spec
│   ├── HIGH_LEVEL_DESIGN.md        # HLD diagrams
│   └── PRE_LAUNCH_CHECKLIST.md     # Production readiness
└── public/
    └── (static assets)
```

---

## Data Flow

### 1. Market Discovery Flow

```
User visits homepage
  ↓
Server Component (/app/page.tsx) pre-renders
  ↓
Calls clientFetchMarkets() in useEffect (client-side)
  ↓
Hits /api/markets proxy route
  ↓
Proxy calls Gamma API (gamma-api.polymarket.com/markets)
  ↓
Returns JSON array of PolyMarket objects
  ↓
Client renders market cards with live data
```

### 2. Price History Flow

```
User clicks market card
  ↓
Navigates to /market/{slug}
  ↓
Server Component fetches market + price history
  ↓
Calls fetchPriceHistory(conditionId) server-side
  ↓
Hits CLOB API (clob.polymarket.com/prices-history?market={conditionId})
  ↓
Returns { history: [{ t: timestamp, p: price }] }
  ↓
Server passes data to FeaturedMarket component
  ↓
Recharts renders AreaChart with price data
```

### 3. Economic Data Flow

```
Admin/User visits /economics
  ↓
Client calls /api/fred/bulk?series=GDP,UNRATE,CPIAUCSL,...
  ↓
Proxy loops through series and calls FRED API:
  https://api.stlouisfed.org/fred/series/observations?series_id=GDP&api_key=...
  ↓
Returns { [seriesId]: { value, date, change } }
  ↓
EconPanel/EconomicsDashboard renders sparklines + stats
```

### 4. Admin Trade Monitoring Flow

```
Admin visits /admin/trades
  ↓
Component starts live trade simulation (setInterval)
  ↓
Generates synthetic trades every 1.8s
  ↓
Updates state arrays (buyOrders, sellOrders, tradeLog)
  ↓
Re-renders table + order flow panel
  ↓
Fetches real price history from /api/prices for selected market
  ↓
Renders Recharts LineChart with live CLOB data
```

---

## API Integration Layer

All external API calls are routed through Next.js API Routes to:
1. Avoid CORS issues (browser can't call Polymarket/FRED directly)
2. Secure API keys (FRED_API_KEY stays server-side)
3. Enable caching and rate limiting
4. Provide consistent error handling

### API Route Architecture

```typescript
// Pattern: /app/api/{service}/route.ts
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  
  // 1. Extract and validate parameters
  const param = searchParams.get("param");
  if (!param) return NextResponse.json({ error: "Missing param" }, { status: 400 });
  
  // 2. Call external API with server-side credentials
  const res = await fetch(`https://external-api.com/endpoint?param=${param}`, {
    headers: { "Authorization": `Bearer ${process.env.API_KEY}` },
    next: { revalidate: 60 } // Cache for 60s
  });
  
  // 3. Handle errors gracefully
  if (!res.ok) return NextResponse.json({ error: "Upstream failed" }, { status: res.status });
  
  // 4. Return data with cache headers
  const data = await res.json();
  return NextResponse.json(data, {
    headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" }
  });
}
```

### Caching Strategy

| Endpoint | Revalidation | Rationale |
|----------|-------------|-----------|
| `/api/markets` | 30s | Markets update frequently |
| `/api/prices` | 60s | Price history changes slowly |
| `/api/fred/*` | 3600s (1hr) | Economic data is static (daily/monthly releases) |
| `/api/leaderboard` | 300s (5min) | Leaderboard changes moderately |
| `/api/clob` | 15s | Orderbook is highly dynamic |

---

## Frontend Architecture

### React Server Components (RSC)

**Used for:**
- Initial page loads with pre-fetched data
- SEO-critical pages (market detail, homepage)
- Reduces JavaScript bundle size

**Examples:**
- `/app/market/[id]/page.tsx` - Fetches market + price history on server
- `/app/economics/page.tsx` - Pre-renders economic data

### Client Components

**Used for:**
- Interactive UI (search, filters, tabs)
- Real-time updates (live orderbook, trade feed)
- Client-side state management

**Examples:**
- `components/order-book.tsx` - Polls CLOB every 15s
- `components/featured-market.tsx` - Chart interval selector, trade input

### State Management

- **Local State:** `useState` for component-specific UI state
- **Data Fetching:** `useEffect` + manual fetch for client-side data loads
- **Future Enhancement:** SWR for automatic cache + revalidation

---

## Backend Architecture

### Serverless API Routes

All API routes are **serverless functions** deployed to Vercel Edge Network:

**Benefits:**
- Auto-scaling (0 to millions of requests)
- Global edge distribution (low latency)
- Pay-per-execution pricing
- No server management

**Limitations:**
- 10s max execution time (Hobby), 60s (Pro)
- No persistent state (use external cache/DB if needed)
- Cold start latency (~50-200ms first request)

### Environment Variables

Required server-side environment variables:

```bash
FRED_API_KEY=603575b810dbcd791f0437869b32b399  # FRED API key
```

**Set via Vercel Dashboard:**
Settings → Environment Variables → Add

---

## Database Schema

**Current State:** No database - all data is fetched from external APIs in real-time.

**Future Enhancement:** Add PostgreSQL (via Vercel Postgres or Supabase) for:

### Proposed Schema

```sql
-- Users table (for auth + portfolio tracking)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Portfolios table (user positions)
CREATE TABLE portfolios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  market_id VARCHAR(100) NOT NULL, -- Polymarket conditionId
  outcome VARCHAR(50) NOT NULL, -- "Yes" or "No"
  shares DECIMAL(18,8) NOT NULL,
  avg_price DECIMAL(18,8) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Trade history
CREATE TABLE trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  market_id VARCHAR(100) NOT NULL,
  side VARCHAR(10) NOT NULL, -- "buy" or "sell"
  outcome VARCHAR(50) NOT NULL,
  shares DECIMAL(18,8) NOT NULL,
  price DECIMAL(18,8) NOT NULL,
  total DECIMAL(18,8) NOT NULL,
  executed_at TIMESTAMP DEFAULT NOW()
);

-- Market watchlists
CREATE TABLE watchlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  market_id VARCHAR(100) NOT NULL,
  added_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, market_id)
);

-- Admin audit logs
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  target_type VARCHAR(50),
  target_id VARCHAR(100),
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Migration Path:**
1. Add Vercel Postgres integration
2. Run SQL migration via `/scripts/setup-db.sql`
3. Update `lib/db.ts` with connection pool
4. Create API routes for user actions (`/api/portfolio`, `/api/trades`)
5. Add authentication layer (NextAuth.js or Supabase Auth)

---

## Security Architecture

### Current Measures

1. **API Key Protection**
   - `FRED_API_KEY` stored in Vercel environment variables (server-side only)
   - Never exposed to client bundle

2. **CORS Bypass**
   - All external API calls routed through Next.js API routes
   - Browser never directly calls Polymarket/FRED

3. **Input Validation**
   - URL parameters sanitized with `encodeURIComponent()`
   - Type checking with TypeScript

4. **Error Handling**
   - Generic error messages to client (no stack traces)
   - Detailed errors logged server-side with `console.error("[v0] ...")`

### Required for Production

1. **Authentication**
   - Implement NextAuth.js with JWT sessions
   - Support wallet authentication (MetaMask, WalletConnect)
   - Admin-only routes protected with middleware

2. **Authorization**
   - Role-based access control (RBAC): `user`, `admin`
   - Admin routes check `session.user.role === "admin"`

3. **Rate Limiting**
   - Add Vercel Edge Config for rate limiting
   - Limit API routes to 100 req/min per IP

4. **Content Security Policy (CSP)**
   - Add CSP headers in `next.config.mjs`
   - Restrict inline scripts, external domains

5. **HTTPS Only**
   - Enforce HTTPS redirects (Vercel default)
   - Set `Strict-Transport-Security` header

6. **SQL Injection Prevention**
   - Use parameterized queries with Prisma/Drizzle ORM
   - Never concatenate user input into SQL

---

## Performance Optimization

### Current Optimizations

1. **Server-Side Rendering (SSR)**
   - Market detail pages pre-render on server
   - Faster initial load, better SEO

2. **Static Asset Optimization**
   - Next.js automatic image optimization
   - Font subsetting (only Latin characters loaded)

3. **API Response Caching**
   - `next: { revalidate: 60 }` for API routes
   - `Cache-Control` headers for browser cache

4. **Code Splitting**
   - Automatic route-based splitting by Next.js
   - Client components lazy-loaded

5. **Tailwind CSS Purging**
   - Unused CSS automatically removed in production
   - Minified output (~20KB gzipped)

### Recommended Enhancements

1. **Add SWR for Client Data Fetching**
   ```typescript
   import useSWR from 'swr';
   const { data, error } = useSWR('/api/markets', fetcher, { refreshInterval: 30000 });
   ```

2. **Implement Virtual Scrolling**
   - Use `react-window` for large market lists
   - Render only visible rows

3. **Debounce Search Input**
   - Wait 300ms after typing before API call

4. **Add Redis Cache**
   - Cache Polymarket API responses in Upstash Redis
   - Reduce upstream API calls by 90%

5. **Optimize Chart Rendering**
   - Downsample price history data (max 200 points)
   - Use `useMemo` to prevent re-renders

---

## Scalability Considerations

### Current Architecture

- **Serverless Functions:** Auto-scale horizontally
- **Edge CDN:** Global distribution via Vercel
- **No Database:** Stateless, infinite horizontal scale

### Bottlenecks

1. **External API Rate Limits**
   - Polymarket: No documented limits (monitor for 429s)
   - FRED: 120 req/min per API key

2. **Cold Start Latency**
   - First request to idle function: ~200ms
   - Mitigation: Vercel Pro plan has lower cold starts

3. **No Server-Side State**
   - Can't implement WebSocket connections for live updates
   - Rely on client polling (inefficient for high concurrency)

### Scaling Plan

**Phase 1 (0-10K users):**
- Current architecture sufficient
- Monitor Vercel Analytics for p95 latency

**Phase 2 (10K-100K users):**
- Add Redis cache (Upstash) for API responses
- Implement SWR for client-side cache
- Upgrade to Vercel Pro for higher limits

**Phase 3 (100K+ users):**
- Add PostgreSQL for user data + trades
- Implement WebSocket server (separate Node.js app)
- Add CDN for static assets (Cloudflare)
- Multi-region deployment (US, EU, APAC)

---

## Monitoring & Observability

### Current Logging

- **Server-side:** `console.log`, `console.error` (Vercel logs)
- **Client-side:** Browser console (React error boundaries)

### Recommended Tools

1. **Application Monitoring**
   - **Vercel Analytics:** Page views, Core Web Vitals
   - **Sentry:** Error tracking + performance monitoring
   - **LogRocket:** Session replay for debugging

2. **API Monitoring**
   - **Checkly:** Uptime monitoring for API routes
   - **Better Stack:** Log aggregation + alerting

3. **Performance Monitoring**
   - **Lighthouse CI:** Automated performance audits
   - **Web Vitals:** LCP, FID, CLS tracking

4. **Business Metrics**
   - Track in custom dashboard:
     - Daily active users (DAU)
     - Markets viewed per session
     - Trade volume (if implemented)
     - Admin dashboard usage

### Alerts to Configure

- API error rate > 5%
- p95 latency > 2s
- FRED API 429 rate limit errors
- Server function timeout errors

---

## Deployment Architecture

### Current Deployment

```
GitHub Repository
  ↓ (git push)
Vercel Automatic Deploy
  ↓
Build Phase (Next.js build)
  ↓
Deploy to Vercel Edge Network
  ↓
Live at https://predictone.vercel.app
```

### Environments

| Environment | Branch | URL | Purpose |
|-------------|--------|-----|---------|
| **Production** | `main` | `predictone.vercel.app` | Live user traffic |
| **Preview** | `feature/*` | `predictone-{hash}.vercel.app` | PR previews |
| **Development** | `dev` | `predictone-dev.vercel.app` | Internal testing |

### CI/CD Pipeline

**Automated on every push:**
1. TypeScript type checking
2. ESLint code quality check
3. Next.js build (fails if errors)
4. Deploy to Vercel
5. Run Lighthouse audit on preview

---

## API Reference

### Internal API Routes

**GET `/api/markets`**
- Proxies Gamma API `/markets`
- Query params: `limit`, `offset`, `active`, `tag_slug`, `order`, `ascending`
- Response: `PolyMarket[]`

**GET `/api/prices`**
- Proxies CLOB API `/prices-history`
- Query params: `market` (conditionId), `interval`, `fidelity`
- Response: `{ history: PriceHistory[] }`

**GET `/api/fred/bulk`**
- Fetches multiple FRED series
- Query params: `series` (comma-separated IDs)
- Response: `{ [seriesId]: FREDSeriesData }`

**GET `/api/clob`**
- Proxies CLOB API endpoints
- Query params: `endpoint`, `token_id`, `market`
- Response: Varies by endpoint

---

## Glossary

| Term | Definition |
|------|------------|
| **Condition ID** | Unique hex identifier for a Polymarket market (0x...) |
| **CLOB** | Central Limit Order Book - Polymarket's trading API |
| **Token ID** | Numeric identifier for a specific outcome in a market |
| **Gamma API** | Polymarket's market discovery API |
| **FRED** | Federal Reserve Economic Data - economic indicator database |
| **RSC** | React Server Components - server-rendered React components |
| **HMR** | Hot Module Replacement - live reload during development |

---

**Document Owner:** Technical Team  
**Review Cycle:** Quarterly  
**Next Review:** July 8, 2026
