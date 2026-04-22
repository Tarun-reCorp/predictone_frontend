"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  Search, SlidersHorizontal, TrendingUp, ChevronDown, X,
  FlaskConical, Activity, Shield, LogOut, User, ChevronUp, Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import { AuthModal } from "@/components/auth-modal";

const NAV_CATEGORIES = [
  { label: "Trending", slug: "" },
  { label: "Politics", slug: "politics" },
  { label: "Crypto", slug: "crypto" },
  { label: "Sports", slug: "sports" },
  { label: "Tech", slug: "tech" },
  { label: "AI", slug: "ai" },
  { label: "Economy", slug: "economy" },
  { label: "Other", slug: "other" },
];

interface HeaderProps {
  activeCategory?: string;
  onCategoryChange?: (slug: string) => void;
  onSearch?: (q: string) => void;
}

export function Header({ activeCategory = "", onCategoryChange, onSearch }: HeaderProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [authModal, setAuthModal] = useState<{ open: boolean; tab: "login" | "signup" }>({
    open: false,
    tab: "login",
  });
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const { user, token, loading, logout } = useAuth();
  const [walletBalance, setWalletBalance] = useState<number | null>(null);

  const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

  useEffect(() => {
    if (user?.role !== "merchant" || !token) { setWalletBalance(null); return; }
    fetch(`${BACKEND}/api/merchant/wallet`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setWalletBalance(d.data?.balance ?? 0))
      .catch(() => {});
  }, [user, token, BACKEND]);

  const isSimulate = pathname === "/simulate";
  const isEconomics = pathname === "/economics";
  const isAdmin = pathname.startsWith("/admin");

  // Debounced search — triggers API call after user stops typing
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debouncedSearch = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onSearch?.(q);
    }, 400);
  }, [onSearch]);

  useEffect(() => {
    if (searchOpen && searchRef.current) searchRef.current.focus();
  }, [searchOpen]);

  // Close user menu when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleCategoryClick = (slug: string) => {
    if (onCategoryChange) {
      onCategoryChange(slug);
    } else {
      router.push(slug ? `/?category=${slug}` : "/");
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch?.(searchQuery.trim());
    if (!onSearch && searchQuery.trim()) {
      router.push(`/?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const openLogin = () => setAuthModal({ open: true, tab: "login" });
  const closeAuth = () => setAuthModal((s) => ({ ...s, open: false }));

  // Initials avatar
  const initials = user?.name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("") ?? "";

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur-sm">
        {/* Top bar */}
        <div className="flex h-14 items-center gap-3 px-4">
          {/* Logo */}
          <Link href="/" prefetch={false} className="flex shrink-0 items-center gap-2 mr-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand">
              <TrendingUp className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="hidden font-bold text-foreground text-lg sm:block tracking-tight">
              Predict<span className="text-brand">One</span>
            </span>
          </Link>

          {/* Search bar */}
          <form
            onSubmit={handleSearch}
            className={cn(
              "flex flex-1 items-center gap-2 rounded-lg border border-border bg-secondary px-3 py-2 transition-all",
              searchOpen ? "border-primary/50 ring-1 ring-primary/20" : ""
            )}
          >
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              ref={searchRef}
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                debouncedSearch(e.target.value.trim());
              }}
              onFocus={() => setSearchOpen(true)}
              onBlur={() => setSearchOpen(false)}
              placeholder="Search markets, events..."
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none min-w-0"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  onSearch?.("");
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
            <div className="hidden sm:flex items-center gap-1">
              <button type="button" className="text-muted-foreground hover:text-foreground p-0.5 rounded">
                <SlidersHorizontal className="h-3.5 w-3.5" />
              </button>
            </div>
          </form>

          {/* Merchant wallet balance pill */}
          {user?.role === "merchant" && walletBalance !== null && (
            <Link
              href="/merchant/wallet"
              className="flex shrink-0 items-center gap-2 rounded-lg border border-yes/30 bg-yes/10 px-3 py-1.5 hover:bg-yes/15 transition-colors"
            >
              <Wallet className="h-3.5 w-3.5 text-yes shrink-0" />
              <div className="leading-tight">
                <p className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider leading-none">Balance</p>
                <p className="text-xs font-bold font-mono text-yes leading-tight">${walletBalance.toFixed(2)}</p>
              </div>
            </Link>
          )}

          {/* Right actions */}
          <div className="flex shrink-0 items-center gap-2">
            {user?.role === "admin" && (
            <Link href="/admin">
              <Button
                size="sm"
                variant="outline"
                className={cn(
                  "hidden sm:flex items-center gap-1.5 border-border font-semibold",
                  isAdmin ? "border-brand/50 text-brand bg-brand/10" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Shield className="h-3.5 w-3.5" />
                Admin
              </Button>
            </Link>
          )}
            {user?.role === "admin" && (
              <>
                <Link href="/economics">
                  <Button
                    size="sm"
                    variant="outline"
                    className={cn(
                      "hidden sm:flex items-center gap-1.5 border-border font-semibold",
                      isEconomics ? "border-brand/50 text-brand bg-brand/10" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Activity className="h-3.5 w-3.5" />
                    Economics
                  </Button>
                </Link>
                <Link href="/simulate">
                  <Button
                    size="sm"
                    variant="outline"
                    className={cn(
                      "hidden sm:flex items-center gap-1.5 border-border font-semibold",
                      isSimulate ? "border-brand/50 text-brand bg-brand/10" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <FlaskConical className="h-3.5 w-3.5" />
                    Simulate
                  </Button>
                </Link>
              </>
            )}

            {/* Auth area */}
            {!loading && (
              <>
                {user ? (
                  /* ── Logged-in user menu ── */
                  <div className="relative" ref={userMenuRef}>
                    <button
                      onClick={() => setUserMenuOpen((v) => !v)}
                      className="flex items-center gap-2 rounded-lg border border-border bg-secondary px-2.5 py-1.5 text-sm font-medium text-foreground hover:bg-secondary/80 transition-colors"
                    >
                      {/* Avatar */}
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-brand text-primary-foreground text-xs font-bold">
                        {initials}
                      </div>
                      <span className="hidden sm:block max-w-[100px] truncate">{user.name}</span>
                      {userMenuOpen ? (
                        <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </button>

                    {userMenuOpen && (
                      <div className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-border bg-card shadow-xl z-50 overflow-hidden">
                        {/* User info */}
                        <div className="px-4 py-3 border-b border-border">
                          <p className="text-sm font-semibold text-foreground truncate">{user.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                          <span className={cn(
                            "mt-1.5 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                            user.role === "admin"
                              ? "bg-brand/15 text-brand"
                              : "bg-secondary text-muted-foreground"
                          )}>
                            {user.role}
                          </span>
                        </div>

                        {/* Menu items */}
                        <div className="p-1">
                          {user.role === "admin" && (
                            <Link
                              href="/admin"
                              onClick={() => setUserMenuOpen(false)}
                              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                            >
                              <Shield className="h-4 w-4" />
                              Admin Panel
                            </Link>
                          )}
                          {user.role === "merchant" && (
                            <Link
                              href="/merchant"
                              onClick={() => setUserMenuOpen(false)}
                              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                            >
                              <User className="h-4 w-4" />
                              Dashboard
                            </Link>
                          )}
                          <button
                            onClick={() => {
                              logout();
                              setUserMenuOpen(false);
                            }}
                            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
                          >
                            <LogOut className="h-4 w-4" />
                            Log Out
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* ── Logged-out buttons ── */
                  <>
                    <Button
                      size="sm"
                      onClick={openLogin}
                      className="bg-brand hover:bg-brand/90 text-primary-foreground font-semibold"
                    >
                      Log In
                    </Button>
                  </>
                )}
              </>
            )}
          </div>
        </div>

        {/* Category nav */}
        <nav className="flex items-center gap-0.5 overflow-x-auto px-4 pb-0 scrollbar-none no-scrollbar">
          {NAV_CATEGORIES.map((cat) => (
            <button
              key={cat.slug}
              onClick={() => handleCategoryClick(cat.slug)}
              className={cn(
                "relative flex shrink-0 items-center px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap",
                activeCategory === cat.slug
                  ? "text-foreground after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-brand after:rounded-t-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {cat.label}
            </button>
          ))}
        </nav>
      </header>

      <AuthModal
        open={authModal.open}
        defaultTab={authModal.tab}
        onClose={closeAuth}
      />
    </>
  );
}
