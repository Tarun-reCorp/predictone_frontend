"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { TrendingUp, Shield, Store, Eye, EyeOff, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { Header } from "@/components/header";
import { FeaturedMarket } from "@/components/featured-market";
import { MarketsFeed } from "@/components/markets-feed";
import { BreakingNews, CommunityComments } from "@/components/left-sidebar";
import { MarketPulse, TraderLeaderboard } from "@/components/right-sidebar";
import { EconPanel } from "@/components/econ-panel";
import { clientFetchMarkets, clientFetchLeaderboard, type PolyMarket, type Leaderboard } from "@/lib/polymarket";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;

/* ── Login page animations ── */
const LOGIN_CSS = `
@keyframes pd-orb1 {
  0%,100% { transform: translate(0,0) scale(1); }
  33%      { transform: translate(70px,-50px) scale(1.08); }
  66%      { transform: translate(-40px,35px) scale(0.94); }
}
@keyframes pd-orb2 {
  0%,100% { transform: translate(0,0) scale(1); }
  33%      { transform: translate(-60px,40px) scale(0.92); }
  66%      { transform: translate(50px,-55px) scale(1.06); }
}
@keyframes pd-orb3 {
  0%,100% { transform: translate(0,0) scale(1); }
  50%      { transform: translate(-45px,-35px) scale(1.12); }
}
@keyframes pd-chart1 { to { stroke-dashoffset: 0; } }
@keyframes pd-chart2 { to { stroke-dashoffset: 0; } }
@keyframes pd-chart3 { to { stroke-dashoffset: 0; } }
@keyframes pd-bar {
  from { transform: scaleY(0); transform-origin: bottom; opacity: 0; }
  to   { transform: scaleY(1); transform-origin: bottom; opacity: 1; }
}
@keyframes pd-float1 {
  0%,100% { transform: translateY(0)   rotate(-1deg); }
  50%      { transform: translateY(-18px) rotate(1deg); }
}
@keyframes pd-float2 {
  0%,100% { transform: translateY(0)   rotate(1deg); }
  50%      { transform: translateY(-22px) rotate(-1deg); }
}
@keyframes pd-float3 {
  0%,100% { transform: translateY(0)   rotate(-0.5deg); }
  50%      { transform: translateY(-14px) rotate(0.5deg); }
}
@keyframes pd-float4 {
  0%,100% { transform: translateY(0)   rotate(1.5deg); }
  50%      { transform: translateY(-20px) rotate(-1.5deg); }
}
@keyframes pd-in {
  from { opacity:0; transform: translateY(32px) scale(0.96); }
  to   { opacity:1; transform: translateY(0)    scale(1);    }
}
@keyframes pd-glow {
  0%,100% { opacity:.45; transform:scale(1);    }
  50%      { opacity:.8;  transform:scale(1.18); }
}
@keyframes pd-scanline {
  0%   { transform: translateY(-100%); }
  100% { transform: translateY(100vh); }
}
.pd-orb1  { animation: pd-orb1  20s ease-in-out infinite; }
.pd-orb2  { animation: pd-orb2  25s ease-in-out infinite; }
.pd-orb3  { animation: pd-orb3  18s ease-in-out infinite; }
.pd-c1    { animation: pd-chart1 3s   ease forwards .6s;  }
.pd-c2    { animation: pd-chart2 3.6s ease forwards 1.1s; }
.pd-c3    { animation: pd-chart3 4.2s ease forwards 1.6s; }
.pd-bar   { animation: pd-bar   .55s ease forwards; }
.pd-f1    { animation: pd-float1  6s ease-in-out infinite; }
.pd-f2    { animation: pd-float2  7s ease-in-out infinite 1s; }
.pd-f3    { animation: pd-float3 5.5s ease-in-out infinite 2s; }
.pd-f4    { animation: pd-float4  8s ease-in-out infinite .5s; }
.pd-in    { animation: pd-in .75s cubic-bezier(.16,1,.3,1) forwards; }
.pd-glow  { animation: pd-glow   3s ease-in-out infinite; }
.pd-scan  { animation: pd-scanline 8s linear infinite; }
`;

/* ── Floating market badge (decorative) ── */
function MarketBadge({ label, value, change, positive }: { label: string; value: string; change: string; positive: boolean }) {
  return (
    <div className="rounded-xl border border-border/25 bg-card/30 backdrop-blur-md px-3.5 py-2.5 opacity-[0.28] select-none">
      <div className="flex items-center gap-2.5">
        <span className={cn("text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded",
          positive ? "bg-yes/20 text-yes" : "bg-no/20 text-no")}>
          {label}
        </span>
        <span className="text-xs font-mono font-semibold text-foreground">{value}</span>
        <span className={cn("text-[11px] font-semibold", positive ? "text-yes" : "text-no")}>{change}</span>
      </div>
    </div>
  );
}

/* ── Login form (shown when not logged in) ── */
function LoginForm() {
  /* ── All logic unchanged ── */
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

  /* candlestick bar data */
  const bars = [
    { x: 60,   h: 42, g: true  }, { x: 140,  h: 68, g: false },
    { x: 220,  h: 32, g: true  }, { x: 300,  h: 85, g: true  },
    { x: 380,  h: 55, g: false }, { x: 460,  h: 48, g: true  },
    { x: 540,  h: 74, g: false }, { x: 620,  h: 36, g: true  },
    { x: 700,  h: 92, g: true  }, { x: 780,  h: 52, g: false },
    { x: 860,  h: 63, g: true  }, { x: 940,  h: 41, g: false },
    { x: 1020, h: 78, g: true  }, { x: 1100, h: 57, g: false },
    { x: 1180, h: 46, g: true  }, { x: 1260, h: 69, g: true  },
    { x: 1340, h: 37, g: false }, { x: 1420, h: 58, g: true  },
  ];

  return (
    <>
      <style>{LOGIN_CSS}</style>

      <div className="min-h-screen bg-background flex items-center justify-center relative overflow-hidden p-4">

        {/* ── Layer 1: Color orbs ── */}
        <div className="pd-orb1 absolute -top-32 -left-32 w-[700px] h-[700px] rounded-full bg-brand/[0.09] blur-[130px] pointer-events-none" />
        <div className="pd-orb2 absolute -bottom-40 -right-20 w-[600px] h-[600px] rounded-full bg-yes/[0.07]  blur-[110px] pointer-events-none" />
        <div className="pd-orb3 absolute top-[55%] left-[55%]  w-[450px] h-[450px] rounded-full bg-no/[0.05]   blur-[90px]  pointer-events-none" />

        {/* ── Layer 2: Dot grid ── */}
        <div className="absolute inset-0 pointer-events-none"
          style={{ backgroundImage: "radial-gradient(circle, oklch(0.45 0.01 240 / 0.28) 1px, transparent 1px)", backgroundSize: "28px 28px" }} />

        {/* ── Layer 3: Trading charts (SVG) ── */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" fill="none">
          {/* Horizontal grid lines */}
          {[160, 320, 480, 620, 740].map(y => (
            <line key={y} x1="0" y1={y} x2="1440" y2={y}
              stroke="oklch(0.38 0.008 240 / 0.18)" strokeWidth="1" strokeDasharray="5 10" />
          ))}
          {/* Volume bars */}
          {bars.map(({ x, h, g }, i) => (
            <rect key={x} className="pd-bar" x={x - 16} y={900 - h - 18} width="32" height={h} rx="3"
              fill={g ? "oklch(0.65 0.18 145 / 0.14)" : "oklch(0.58 0.22 25 / 0.12)"}
              style={{ animationDelay: `${i * 0.08}s` }} />
          ))}
          {/* Chart line 1 — brand blue (main trend) */}
          <path className="pd-c1"
            d="M -60 670 C 80 630 160 575 290 505 C 390 450 445 472 560 418 C 660 372 715 328 830 288 C 935 253 990 274 1110 245 C 1215 220 1285 192 1500 158"
            stroke="oklch(0.6 0.2 250 / 0.3)" strokeWidth="2.5"
            strokeDasharray="2200" strokeDashoffset="2200" strokeLinecap="round" />
          {/* Chart line 2 — yes/green (secondary) */}
          <path className="pd-c2"
            d="M -60 790 C 110 755 215 715 370 668 C 475 635 530 655 665 610 C 768 575 828 545 950 522 C 1062 502 1128 488 1265 464 C 1378 444 1430 430 1500 415"
            stroke="oklch(0.65 0.18 145 / 0.18)" strokeWidth="1.8"
            strokeDasharray="2200" strokeDashoffset="2200" strokeLinecap="round" />
          {/* Chart line 3 — no/red (tertiary) */}
          <path className="pd-c3"
            d="M -60 840 C 160 810 265 778 415 742 C 530 715 592 732 730 700 C 840 674 905 655 1035 638 C 1150 623 1225 612 1500 590"
            stroke="oklch(0.58 0.22 25 / 0.13)" strokeWidth="1.5"
            strokeDasharray="2200" strokeDashoffset="2200" strokeLinecap="round" />
          {/* Glow under main chart */}
          <path
            d="M -60 670 C 80 630 160 575 290 505 C 390 450 445 472 560 418 C 660 372 715 328 830 288 C 935 253 990 274 1110 245 C 1215 220 1285 192 1500 158 L 1500 900 L -60 900 Z"
            fill="url(#chartGrad)" />
          <defs>
            <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="oklch(0.6 0.2 250)" stopOpacity="0.06" />
              <stop offset="100%" stopColor="oklch(0.6 0.2 250)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {/* Scan line effect */}
          <rect className="pd-scan" x="0" y="0" width="1440" height="3"
            fill="url(#scanGrad)" opacity="0.25" />
          <defs>
            <linearGradient id="scanGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%"   stopColor="transparent" />
              <stop offset="50%"  stopColor="oklch(0.6 0.2 250)" />
              <stop offset="100%" stopColor="transparent" />
            </linearGradient>
          </defs>
        </svg>

        {/* ── Layer 4: Floating market badges (wide screens only) ── */}
        <div className="pd-f1 absolute top-[17%] left-[7%]  hidden 2xl:block pointer-events-none">
          <MarketBadge label="YES" value="72.4%" change="+5.2%" positive />
        </div>
        <div className="pd-f2 absolute top-[42%] right-[6%] hidden 2xl:block pointer-events-none">
          <MarketBadge label="ETH"  value="$3,412" change="+1.7%" positive />
        </div>
        <div className="pd-f3 absolute bottom-[26%] left-[5%] hidden 2xl:block pointer-events-none">
          <MarketBadge label="NO"  value="27.6%" change="-3.8%" positive={false} />
        </div>
        <div className="pd-f4 absolute top-[24%] right-[8%] hidden 2xl:block pointer-events-none">
          <MarketBadge label="BTC"  value="$67.4K" change="+2.1%" positive />
        </div>

        {/* ── Layer 5: "Playdict" watermark ── */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden">
          <span className="text-[22vw] font-black tracking-tighter leading-none text-brand/[0.038]"
            style={{ filter: "blur(2px)", fontStretch: "condensed" }}>
            Playdict
          </span>
        </div>

        {/* ── Login card ── */}
        <div className="pd-in relative z-10 w-full max-w-[390px]">

          {/* Logo */}
          <div className="flex flex-col items-center gap-3 mb-8">
            <div className="relative">
              <div className="pd-glow absolute inset-0 rounded-2xl bg-brand/40 blur-2xl" />
              <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-brand shadow-xl shadow-brand/40">
                <TrendingUp className="h-7 w-7 text-white" />
              </div>
            </div>
            <div className="text-center">
              <h1 className="text-[3rem] font-black tracking-tight leading-none text-foreground">
                Play<span className="text-brand">dict</span>
              </h1>
              <p className="text-xs text-muted-foreground mt-2 tracking-[0.15em] uppercase font-medium">
                Prediction Markets Platform
              </p>
            </div>
          </div>

          {/* Glass card */}
          <div className="rounded-2xl border border-white/[0.07] bg-card/70 backdrop-blur-2xl p-7 space-y-5"
            style={{
              boxShadow: [
                "0 0 0 1px oklch(0.6 0.2 250 / 0.1)",
                "0 32px 64px oklch(0 0 0 / 0.55)",
                "0 0 100px oklch(0.6 0.2 250 / 0.07)",
                "inset 0 1px 0 oklch(1 0 0 / 0.05)",
              ].join(", "),
            }}>

            {/* Role toggle */}
            <div className="flex rounded-xl border border-border/50 bg-secondary/70 p-1 gap-1">
              {(["admin", "merchant"] as const).map((r) => (
                <button key={r} type="button" onClick={() => { setRole(r); setError(""); }}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold transition-all duration-200",
                    role === r
                      ? "bg-card text-foreground shadow-md border border-border/60 scale-[1.02]"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                  )}>
                  {r === "admin" ? <Shield className="h-3.5 w-3.5" /> : <Store className="h-3.5 w-3.5" />}
                  {r.charAt(0).toUpperCase() + r.slice(1)}
                </button>
              ))}
            </div>

            {/* Error */}
            {error && (
              <div className="rounded-xl bg-destructive/10 border border-destructive/25 px-3.5 py-2.5 text-xs text-destructive flex items-start gap-2">
                <span className="mt-0.5 shrink-0 text-sm">⚠</span>
                {error}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground/85">Email</label>
                <input
                  type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder={role === "admin" ? "admin@example.com" : "merchant@example.com"}
                  autoComplete="email" required
                  className="w-full rounded-xl border border-border/50 bg-secondary/50 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none transition-all duration-200 hover:border-border hover:bg-secondary/70 focus:border-brand/60 focus:ring-2 focus:ring-brand/15 focus:bg-secondary/80"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground/85">Password</label>
                <div className="relative">
                  <input
                    type={showPw ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)}
                    placeholder="Your password" autoComplete="current-password" required
                    className="w-full rounded-xl border border-border/50 bg-secondary/50 px-4 py-3 pr-11 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none transition-all duration-200 hover:border-border hover:bg-secondary/70 focus:border-brand/60 focus:ring-2 focus:ring-brand/15 focus:bg-secondary/80"
                  />
                  <button type="button" onClick={() => setShowPw((v) => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <button type="submit" disabled={loading}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-brand hover:bg-brand/90 active:scale-[0.98] disabled:opacity-55 text-white font-bold h-11 text-sm transition-all duration-200 shadow-lg shadow-brand/30 hover:shadow-xl hover:shadow-brand/40"
                style={{ marginTop: "6px" }}>
                {loading
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <><span>Sign In</span><span className="opacity-70">→</span></>}
              </button>
            </form>
          </div>

          {/* Footer */}
          <p className="text-center text-[11px] text-muted-foreground/30 mt-6 tracking-wide">
            Playdict © 2025 &nbsp;·&nbsp; Secure Login
          </p>
        </div>
      </div>
    </>
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
