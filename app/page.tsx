"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { TrendingUp, Shield, Store, Eye, EyeOff, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { Header } from "@/components/header";
import { FeaturedMarket } from "@/components/featured-market";
import { MarketsFeed } from "@/components/markets-feed";
import { BreakingNews, CommunityComments, Watchlist } from "@/components/left-sidebar";
import { MarketPulse, TraderLeaderboard, AIPredictions, HotTopics } from "@/components/right-sidebar";
import { EconPanel } from "@/components/econ-panel";
import { clientFetchMarkets, clientFetchLeaderboard, type PolyMarket, type Leaderboard } from "@/lib/polymarket";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;

/* ── Login form (shown when not logged in) ── */
function LoginForm() {
  const { login } = useAuth();
  const router = useRouter();
  const [role, setRole] = useState<"admin" | "merchant">("admin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const user = await login(email, password);
      if (user.role !== role) {
        setError(`This account is registered as a ${user.role}, not ${role}.`);
        setLoading(false);
        return;
      }
      router.replace(role === "admin" ? "/admin" : "/merchant");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center gap-2 mb-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand shadow-lg shadow-brand/20">
            <TrendingUp className="h-6 w-6 text-primary-foreground" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Predict<span className="text-brand">One</span>
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">Prediction Markets Platform</p>
          </div>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-border bg-card p-6 space-y-5">
          {/* Role toggle */}
          <div className="flex rounded-lg border border-border bg-secondary p-1 gap-1">
            {(["admin", "merchant"] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => { setRole(r); setError(""); }}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 rounded-md py-1.5 text-sm font-semibold transition-all",
                  role === r
                    ? "bg-card text-foreground shadow-sm border border-border"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {r === "admin" ? <Shield className="h-3.5 w-3.5" /> : <Store className="h-3.5 w-3.5" />}
                {r.charAt(0).toUpperCase() + r.slice(1)}
              </button>
            ))}
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={role === "admin" ? "admin@example.com" : "merchant@example.com"}
                autoComplete="email"
                required
                className="w-full rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-all focus:border-brand/50 focus:ring-1 focus:ring-brand/20"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Password</label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Your password"
                  autoComplete="current-password"
                  required
                  className="w-full rounded-lg border border-border bg-secondary px-3 py-2.5 pr-10 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-all focus:border-brand/50 focus:ring-1 focus:ring-brand/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-brand hover:bg-brand/90 disabled:opacity-60 text-primary-foreground font-semibold h-10 text-sm transition-colors"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign In"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

/* ── Markets feed (shown when logged in) ── */
function MarketsFeedPage() {
  const router = useRouter();
  const [activeCategory, setActiveCategory] = useState("");
  const [markets, setMarkets] = useState<PolyMarket[]>([]);
  const [leaderboard, setLeaderboard] = useState<Leaderboard[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const leaderboardFetched = useRef(false);

  // Reset page when category changes
  const handleCategoryChange = useCallback((cat: string) => {
    setPage(0);
    setSearchQuery("");
    setActiveCategory(cat);
  }, []);

  // Handle search from header
  const handleSearch = useCallback((q: string) => {
    setSearchQuery(q);
    setPage(0);
  }, []);

  // Refetch from backend whenever category, page, or search changes
  useEffect(() => {
    setLoading(true);
    setMarkets([]);
    const params: Parameters<typeof clientFetchMarkets>[0] = {
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
      active: true,
      order: "volume",
      ascending: false,
    };
    if (activeCategory) params.category = activeCategory;
    if (searchQuery) params.search = searchQuery;

    clientFetchMarkets(params)
      .then((data) => {
        setMarkets(data);
        setHasMore(data.length === PAGE_SIZE);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [activeCategory, page, searchQuery]);

  // Leaderboard fetched once
  useEffect(() => {
    if (leaderboardFetched.current) return;
    leaderboardFetched.current = true;
    clientFetchLeaderboard().then(setLeaderboard).catch(() => {});
  }, []);

  const featured = markets[0];

  return (
    <div className="min-h-screen bg-background">
      <Header
        activeCategory={activeCategory}
        onCategoryChange={handleCategoryChange}
        onSearch={handleSearch}
      />
      <div className="mx-auto max-w-[1600px] px-4 py-4">
        <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr_220px] xl:grid-cols-[240px_1fr_240px] gap-4">
          <aside className="hidden lg:flex flex-col gap-3">
            <BreakingNews />
            <CommunityComments />
            {markets.length > 0 && <Watchlist markets={markets} />}
          </aside>
          <main className="flex flex-col gap-4 min-w-0">
            {featured && !loading && (
              <FeaturedMarket
                market={featured}
                onBuy={(outcome) => {
                  const path = `/market/${featured.slug || featured.id}`;
                  router.push(`${path}?buy=${outcome.toLowerCase()}`);
                }}
              />
            )}
            <MarketsFeed
              markets={markets}
              loading={loading}
              title={activeCategory ? `${activeCategory.charAt(0).toUpperCase() + activeCategory.slice(1)} Markets` : "All Markets"}
              page={page}
              hasMore={hasMore}
              onPageChange={setPage}
            />
          </main>
          <aside className="hidden lg:flex flex-col gap-3">
            {markets.length > 0 && <MarketPulse markets={markets} />}
            <EconPanel />
            <TraderLeaderboard entries={leaderboard} />
            {markets.length > 0 && <AIPredictions markets={markets} />}
            {markets.length > 0 && <HotTopics markets={markets} />}
          </aside>
        </div>
      </div>
    </div>
  );
}

/* ── Root page ── */
export default function Page() {
  const { user, loading } = useAuth();

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="h-6 w-6 rounded-full border-2 border-brand border-t-transparent animate-spin" />
    </div>
  );

  return user ? <MarketsFeedPage /> : <LoginForm />;
}
