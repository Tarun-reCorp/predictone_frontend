# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start dev server (Next.js on default port 3000)
npm run build    # Production build
npm run lint     # ESLint check
npm start        # Start production server
```

No test framework is configured.

## Environment

Copy `.env.local` and set:
- `FRED_API_KEY` — Federal Reserve Economic Data API key
- `NEXT_PUBLIC_API_URL` — Backend API base URL (defaults to `http://localhost:4000`)

## Architecture

**PredictOne** is a prediction markets platform using **Next.js 15 App Router** with **React 19**.

### Routing & Role Guards

Routes are file-based under `/app`. Auth guards live in layout files — they check the user's role from `AuthContext` and redirect via `useRouter`:
- `/` — Public: shows login form for unauthenticated users or markets feed for authenticated ones
- `/admin/**` — Admin-only dashboard (Overview, Markets, Merchants, Trades, Economics, Simulation, Settings)
- `/merchant/**` — Merchant-only dashboard
- `/market/[id]` — Dynamic market detail with order book
- `/economics` — FRED economic indicators view
- `/simulate` — Synthetic market simulation

### API Layer (`/app/api/`)

Next.js Route Handlers act as a proxy/aggregation layer between the frontend and external services:
- `/api/markets`, `/api/markets/[id]` — Wraps the backend at `NEXT_PUBLIC_API_URL`
- `/api/clob` — Polymarket CLOB (order book) data
- `/api/fred/*` — Federal Reserve Economic Data
- `/api/prices`, `/api/leaderboard`, `/api/events` — Other backend proxies

CORS headers are set in `next.config.ts` for all API routes.

### State Management

- **Auth**: `AuthContext` (`/contexts/auth-context.tsx`) — stores user, token, role; token persisted as `po_token` in localStorage
- **Wallet**: `useWallet` hook (`/hooks/use-wallet.ts`) — MetaMask integration via `window.ethereum`
- **Local state**: `useState` throughout components — no Redux or Zustand

### Data Sources (`/lib/`)

- `lib/auth.ts` — Login, signup, `/me` endpoint calls to backend
- `lib/polymarket.ts` — Polymarket API client (market data, price history)
- `lib/fred.ts` — FRED API client (economic indicators)
- `lib/simulation.ts` — Generates synthetic market data for the simulation page
- `lib/wallet.ts` — MetaMask helpers (address formatting, chain names)
- `lib/utils.ts` — `cn()` utility (clsx + tailwind-merge)

### Component Structure

- `/components/ui/` — shadcn/ui components (Radix UI primitives + Tailwind). Do not hand-edit these unless necessary; they are managed by the shadcn CLI.
- Feature components live directly in `/components/` — major ones include `markets-feed.tsx`, `order-book.tsx`, `left-sidebar.tsx`, `right-sidebar.tsx`, `econ-panel.tsx`, `auth-modal.tsx`.

### Styling

Tailwind CSS v4 via `@tailwindcss/postcss`. Colors use `oklch` format in CSS variables. Dark-first theme. Path alias `@/` maps to the project root.

### Key Dependencies

- `recharts` — charts/graphs
- `react-hook-form` + `zod` — form validation
- `sonner` — toast notifications
- `lucide-react` — icons
- `@vercel/analytics` — analytics (production)
- `shadcn/ui` config in `components.json` (style: new-york, base color: neutral)

### TypeScript

`tsconfig.json` has strict mode enabled. `next.config.ts` sets `ignoreBuildErrors: true`, so the build won't fail on type errors — but type correctness still matters.
