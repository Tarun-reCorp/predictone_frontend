"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ExternalLink, Clock, BarChart2, Droplets, Users } from "lucide-react";
import {
  parseOutcomes,
  parseOutcomePrices,
  formatVolume,
  clientFetchMarketById,
  clientFetchMarkets,
  type PolyMarket,
} from "@/lib/polymarket";
import { FeaturedMarket } from "@/components/featured-market";
import { MarketCard } from "@/components/market-card";
import { OrderBook } from "@/components/order-book";
import { Header } from "@/components/header";
import { AuthModal } from "@/components/auth-modal";
import { OrderSuccessModal } from "@/components/order-success-modal";
import { useOrder } from "@/hooks/use-order";

export default function MarketPage() {
  const { id } = useParams<{ id: string }>();
  const [market, setMarket] = useState<PolyMarket | null>(null);
  const [related, setRelated] = useState<PolyMarket[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFoundState, setNotFoundState] = useState(false);

  // Direct order placement (for FeaturedMarket inline form)
  const {
    placeOrder,
    isPlacing: isFeaturedPlacing,
    error: featuredError,
    clearError: clearFeaturedError,
    isLoggedIn,
  } = useOrder();


  // Success popup state
  const [successModal, setSuccessModal] = useState<{
    open: boolean; outcome: "Yes" | "No" | null; amount: number;
  }>({ open: false, outcome: null, amount: 0 });

  // Shared trade type — controlled from both FeaturedMarket toggle and Outcomes buttons
  const [tradeType, setTradeType] = useState<"yes" | "no">("yes");
  const featuredRef = useRef<HTMLDivElement>(null);
  const [authModal, setAuthModal] = useState<{ open: boolean; tab: "login" | "signup" }>({ open: false, tab: "login" });

  // Outcomes "Buy" button → switch FeaturedMarket to the right side and scroll to it
  const handleOutcomeBuy = (outcome: "Yes" | "No") => {
    setTradeType(outcome === "Yes" ? "yes" : "no");
    featuredRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  // Direct buy — shows loading modal, places order, transitions to success/error
  const handleFeaturedBuy = async (outcome: "Yes" | "No", amount: number) => {
    if (!isLoggedIn) {
      setAuthModal({ open: true, tab: "login" });
      return;
    }
    if (!market) return;
    clearFeaturedError();
    setSuccessModal({ open: true, outcome, amount });
    try {
      await Promise.all([
        placeOrder({
          marketId: market.id || market.conditionId,
          outcome,
          amount,
          marketQuestion: market.question,
        }),
        new Promise((r) => setTimeout(r, 5000)),
      ]);
    } catch {
      // error captured by useOrder; modal transitions to error phase automatically
    }
  };

  useEffect(() => {
    if (!id) return;
    setLoading(true);

    clientFetchMarketById(id).then(async (m) => {
      if (!m) {
        setNotFoundState(true);
        setLoading(false);
        return;
      }
      setMarket(m);

      const allMarkets = await clientFetchMarkets({ limit: 10, active: true, order: "volume", ascending: false });
      setRelated(allMarkets.filter((x) => x.conditionId !== m.conditionId).slice(0, 4));
      setLoading(false);
    });
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="mx-auto max-w-7xl px-4 py-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 w-32 rounded bg-secondary" />
            <div className="h-64 rounded-xl bg-secondary" />
            <div className="grid grid-cols-4 gap-3">
              {[...Array(4)].map((_, i) => <div key={i} className="h-20 rounded-xl bg-secondary" />)}
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (notFoundState || !market) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="mx-auto max-w-7xl px-4 py-6 text-center">
          <p className="text-muted-foreground mt-20">Market not found.</p>
          <Link href="/" className="mt-4 inline-flex items-center gap-2 text-sm text-brand hover:underline">
            <ArrowLeft className="h-4 w-4" /> Back to Markets
          </Link>
        </main>
      </div>
    );
  }

  const outcomes = parseOutcomes(market.outcomes);
  const prices = parseOutcomePrices(market.outcomePrices);
  const yesPct = Math.round((prices[0] ?? 0.5) * 100);

  let firstTokenId: string | null = null;
  try {
    const ids: string[] = JSON.parse(market.clobTokenIds ?? "[]");
    firstTokenId = ids[0] ?? null;
  } catch {}

  const endDate = market.endDate
    ? new Date(market.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "N/A";

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-5"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Markets
        </Link>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
          {/* Main content */}
          <div className="lg:col-span-3 space-y-6">
            <div ref={featuredRef}>
              <FeaturedMarket
                market={market}
                onBuy={handleFeaturedBuy}
                isLoggedIn={isLoggedIn}
                isPlacing={isFeaturedPlacing}
                placeError={featuredError}
                tradeType={tradeType}
                onTradeTypeChange={setTradeType}
              />
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { icon: BarChart2, label: "24h Volume",     value: formatVolume(market.volumeNum ?? market.volume),        color: "text-brand" },
                { icon: Droplets, label: "Liquidity",       value: formatVolume(market.liquidityNum ?? market.liquidity),  color: "text-yes" },
                { icon: Clock,    label: "Ends",            value: endDate,                                                color: "text-foreground" },
                { icon: Users,    label: "Yes Probability", value: `${yesPct}%`,                                           color: yesPct >= 50 ? "text-yes" : "text-no" },
              ].map((stat) => (
                <div key={stat.label} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-center gap-2 mb-1.5">
                    <stat.icon className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">{stat.label}</span>
                  </div>
                  <p className={`text-lg font-bold font-mono ${stat.color}`}>{stat.value}</p>
                </div>
              ))}
            </div>

            {/* Description */}
            {market.description && (
              <div className="rounded-xl border border-border bg-card p-5">
                <h2 className="mb-3 text-sm font-semibold text-foreground">About this Market</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">{market.description}</p>
                {market.resolutionSource && (
                  <a
                    href={market.resolutionSource}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-1.5 text-xs text-brand hover:underline"
                  >
                    Resolution Source <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            )}

            {/* Outcomes */}
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="px-5 py-3 border-b border-border/50">
                <h2 className="text-sm font-semibold text-foreground">Outcomes</h2>
              </div>
              <div className="divide-y divide-border/30">
                {outcomes.map((outcome, i) => {
                  const pct   = Math.round((prices[i] ?? 0.5) * 100);
                  const price = prices[i] ?? 0.5;
                  const isYes = i === 0;
                  const typedOutcome = isYes ? "Yes" : "No";
                  return (
                    <div key={outcome} className="flex items-center gap-4 px-5 py-3">
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-sm font-medium text-foreground">{outcome}</span>
                          <span className={`text-sm font-bold font-mono ${isYes ? "text-yes" : "text-no"}`}>${price.toFixed(2)}</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                          <div className={`h-full transition-all ${isYes ? "bg-yes" : "bg-no"}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                      {market.conditionId && (
                        <button
                          onClick={() => handleOutcomeBuy(typedOutcome)}
                          className={`shrink-0 rounded-lg px-4 py-1.5 text-sm font-semibold transition-all ${
                            isYes
                              ? "bg-yes/10 text-yes border border-yes/20 hover:bg-yes/20 active:bg-yes/30"
                              : "bg-no/10  text-no  border border-no/20  hover:bg-no/20  active:bg-no/30"
                          }`}
                        >
                          Buy ${price.toFixed(2)}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right panel */}
          <div className="space-y-4">
            {firstTokenId && <OrderBook tokenId={firstTokenId} yesPct={yesPct} />}

            {market.tags && market.tags.length > 0 && (
              <div className="rounded-xl border border-border bg-card p-4">
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Categories</h3>
                <div className="flex flex-wrap gap-2">
                  {market.tags.map((tag) => (
                    <Link
                      key={tag.id}
                      href={`/?category=${tag.slug}`}
                      className="rounded-full bg-secondary border border-border px-3 py-1 text-xs text-foreground hover:border-primary/40 transition-colors"
                    >
                      {tag.label}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Market Info</h3>
              <div className="space-y-2">
                {[
                  { label: "Market ID",  value: market.conditionId?.slice(0, 16) + "..." },
                  { label: "Start Date", value: market.startDate ? new Date(market.startDate).toLocaleDateString() : "N/A" },
                  { label: "End Date",   value: endDate },
                  { label: "Status",     value: market.active ? "Active" : market.closed ? "Closed" : "Archived" },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{row.label}</span>
                    <span className="text-xs font-mono text-foreground">{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Related markets */}
        {related.length > 0 && (
          <div className="mt-8">
            <h2 className="mb-4 text-base font-semibold text-foreground">Related Markets</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {related.map((m) => <MarketCard key={m.conditionId} market={m} />)}
            </div>
          </div>
        )}
      </main>

      {/* ── Order Success / Error Modal ── */}
      <OrderSuccessModal
        open={successModal.open}
        onClose={() => setSuccessModal((s) => ({ ...s, open: false }))}
        isPlacing={isFeaturedPlacing}
        outcome={successModal.outcome}
        amount={successModal.amount}
        error={featuredError}
      />

      {/* ── Auth Modal (triggered from BuyModal when not logged in) ── */}
      <AuthModal
        open={authModal.open}
        defaultTab={authModal.tab}
        onClose={() => setAuthModal((s) => ({ ...s, open: false }))}
      />
    </div>
  );
}
