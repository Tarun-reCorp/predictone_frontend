"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Wallet, Receipt, Clock,
  Loader2,
  QrCode, CreditCard, Bitcoin, Copy, Check, AlertCircle,
  ArrowRight, ExternalLink,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

// ── Types ──────────────────────────────────────────────────────────────────────

interface WalletInfo {
  balance: number;
  totalCommissionPaid: number;
  pendingCount: number;
}

interface UpiPayinResponse {
  txn_id: string;
  qr_string: string;
  qr_code: string;
  paymentLink: string;
}

interface CardPayinResponse {
  status: string;
  message: string;
  url: string;
  order_ref_no: string;
}

type FundTab = "upi" | "crypto" | "card";

// ── Constants ──────────────────────────────────────────────────────────────────

const FUND_TABS: { key: FundTab; label: string; icon: React.ElementType; disabled?: boolean }[] = [
  { key: "upi",    label: "UPI",    icon: QrCode     },
  { key: "crypto", label: "Crypto", icon: Bitcoin     },
  { key: "card",   label: "Card",   icon: CreditCard },
];

const PRESETS = [100, 500, 1000, 5000];

const CRYPTO_WALLET = "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18";
const CRYPTO_NETWORK = "Polygon (MATIC)";

function generateOrderId(): string {
  return `PO-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function generateCardOrderRef(): string {
  return `CARD-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function MerchantWalletPage() {
  const { token } = useAuth();

  // Wallet data
  const [info, setInfo]       = useState<WalletInfo | null>(null);
  const [loading, setLoading] = useState(true);

  // Add Funds
  const [fundTab, setFundTab] = useState<FundTab>("upi");

  // UPI state
  const [upiAmount, setUpiAmount]           = useState("");
  const [upiLoading, setUpiLoading]         = useState(false);
  const [upiError, setUpiError]             = useState<string | null>(null);
  const [upiPayin, setUpiPayin]             = useState<UpiPayinResponse | null>(null);
  const [upiOrderId, setUpiOrderId]         = useState<string | null>(null);

  // Card state
  const [cardAmount, setCardAmount]         = useState("");
  const [cardName, setCardName]             = useState("");
  const [cardEmail, setCardEmail]           = useState("");
  const [cardPhone, setCardPhone]           = useState("");
  const [cardAddress, setCardAddress]       = useState("");
  const [cardCity, setCardCity]             = useState("");
  const [cardCountry, setCardCountry]       = useState("India");
  const [cardLoading, setCardLoading]       = useState(false);
  const [cardError, setCardError]           = useState<string | null>(null);
  const [cardPayin, setCardPayin]           = useState<CardPayinResponse | null>(null);

  // Crypto copy
  const [copied, setCopied] = useState(false);

  // ── Wallet info fetch ────────────────────────────────────────────────────────

  const loadWalletInfo = useCallback(() => {
    if (!token) return;
    fetch(`${API}/api/merchant/wallet`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => setInfo(d.data)).catch(() => {}).finally(() => setLoading(false));
  }, [token]);

  useEffect(() => { loadWalletInfo(); }, [loadWalletInfo]);

  // ── UPI: Create Payin ────────────────────────────────────────────────────────

  const handleUpiPayin = async () => {
    const amt = parseFloat(upiAmount);
    if (!amt || amt < 1) { setUpiError("Minimum amount is ₹1"); return; }
    if (amt > 100000) { setUpiError("Maximum amount is ₹1,00,000"); return; }

    setUpiError(null);
    setUpiLoading(true);
    setUpiPayin(null);

    const orderId = generateOrderId();
    setUpiOrderId(orderId);

    try {
      const res = await fetch(`${API}/api/payment/upi/payin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: orderId, amount: String(amt) }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Payment creation failed");

      setUpiPayin({
        txn_id: json.txn_id,
        qr_string: json.qr_string,
        qr_code: json.qr_code,
        paymentLink: json.paymentLink,
      });

      // Open payment page in new tab (same behavior as card)
      if (json.paymentLink) {
        window.open(json.paymentLink, "_blank", "noopener,noreferrer");
      }

      // Auto-create a draft fund request so the merchant can submit UTR later
      if (token) {
        try {
          await fetch(`${API}/api/merchant/fund-requests/draft`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ amount: parseFloat(upiAmount), orderId, paymentMethod: "upi" }),
          });
        } catch {
          // silently fail — merchant can still submit a manual fund request
        }
      }
    } catch (err: unknown) {
      setUpiError(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setUpiLoading(false);
    }
  };

  const resetUpi = () => {
    setUpiPayin(null);
    setUpiOrderId(null);
    setUpiAmount("");
    setUpiError(null);
  };

  // ── Card: Create Payin ───────────────────────────────────────────────────────

  const handleCardPayin = async () => {
    const amt = parseFloat(cardAmount);
    if (!amt || amt <= 0) { setCardError("Enter a valid amount"); return; }
    if (!cardName.trim() || !cardEmail.trim() || !cardPhone.trim()) {
      setCardError("Name, email and phone are required");
      return;
    }

    setCardError(null);
    setCardLoading(true);
    setCardPayin(null);

    const orderRef = generateCardOrderRef();
    const redirectUrl =
      typeof window !== "undefined"
        ? `${window.location.origin}/merchant/fund-requests?card_ord=${orderRef}`
        : "https://google.com/";

    try {
      const res = await fetch(`${API}/api/payment/card/payin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: String(amt),
          order_ref_no: orderRef,
          redirect_url: redirectUrl,
          name: cardName,
          address_1: cardAddress || "N/A",
          city: cardCity || "N/A",
          country: cardCountry || "India",
          email: cardEmail,
          phone: cardPhone,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.url) throw new Error(json.message ?? "Card payment creation failed");

      setCardPayin({
        status: json.status,
        message: json.message,
        url: json.url,
        order_ref_no: orderRef,
      });

      // Open payment page in new tab
      window.open(json.url, "_blank", "noopener,noreferrer");

      // Auto-create a draft fund request so the merchant can submit reference later
      if (token) {
        try {
          await fetch(`${API}/api/merchant/fund-requests/draft`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ amount: amt, orderId: orderRef, paymentMethod: "card" }),
          });
        } catch {
          // silently fail — merchant can still submit a manual fund request
        }
      }
    } catch (err: unknown) {
      setCardError(err instanceof Error ? err.message : "Card payment failed");
    } finally {
      setCardLoading(false);
    }
  };

  const resetCard = () => {
    setCardPayin(null);
    setCardAmount("");
    setCardName("");
    setCardEmail("");
    setCardPhone("");
    setCardAddress("");
    setCardCity("");
    setCardCountry("India");
    setCardError(null);
  };

  // ── Crypto: Copy ─────────────────────────────────────────────────────────────

  const copyAddress = () => {
    navigator.clipboard.writeText(CRYPTO_WALLET);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Wallet</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Your balance and fund management</p>
      </div>

      {/* Balance cards */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="h-28 rounded-xl bg-secondary animate-pulse" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-xl border border-border bg-card p-5 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium uppercase tracking-wider">
              <Wallet className="h-3.5 w-3.5" /> Current Balance
            </div>
            <p className="text-3xl font-bold font-mono text-yes">${(info?.balance ?? 0).toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">Available balance</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-5 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium uppercase tracking-wider">
              <Receipt className="h-3.5 w-3.5" /> Commission Paid
            </div>
            <p className="text-3xl font-bold font-mono text-chart-4">${(info?.totalCommissionPaid ?? 0).toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">Total deducted</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-5 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium uppercase tracking-wider">
              <Clock className="h-3.5 w-3.5" /> Pending Requests
            </div>
            <p className="text-3xl font-bold font-mono text-brand">{info?.pendingCount ?? 0}</p>
            <Link href="/merchant/fund-requests" className="text-xs text-brand hover:underline">View all</Link>
          </div>
        </div>
      )}

      {/* ── Add Funds Section ── */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
          {/* Tab bar */}
          <div className="flex border-b border-border">
            {FUND_TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => { if (!tab.disabled) { setFundTab(tab.key); resetUpi(); resetCard(); } }}
                disabled={tab.disabled}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-medium transition-colors border-b-2 -mb-px",
                  fundTab === tab.key && !tab.disabled
                    ? "border-brand text-brand"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                  tab.disabled && "opacity-40 cursor-not-allowed"
                )}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
                {tab.disabled && (
                  <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[9px] font-semibold text-muted-foreground">
                    Soon
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="p-6">
            {/* ───── UPI Tab ───── */}
            {fundTab === "upi" && (
              <div className="space-y-5">

                {/* Idle: Amount input */}
                {!upiPayin && (
                  <>
                    <div>
                      <h3 className="text-base font-semibold text-foreground">Add Funds via UPI</h3>
                      <p className="text-xs text-muted-foreground mt-1">Enter amount and scan QR code or use payment link to pay</p>
                    </div>

                    <div className="space-y-3">
                      <label className="text-xs font-medium text-muted-foreground">Amount (INR)</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-mono">₹</span>
                        <input
                          type="number"
                          min={1}
                          max={100000}
                          step="1"
                          placeholder="Enter amount"
                          value={upiAmount}
                          onChange={(e) => { setUpiAmount(e.target.value); setUpiError(null); }}
                          className="w-full rounded-lg border border-border bg-background pl-7 pr-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-brand/40 focus:border-brand/40 transition-colors"
                        />
                      </div>

                      <div className="grid grid-cols-4 gap-2">
                        {PRESETS.map(amt => (
                          <button
                            key={amt}
                            onClick={() => { setUpiAmount(String(amt)); setUpiError(null); }}
                            className={cn(
                              "rounded-md border py-1.5 text-xs font-medium transition-colors",
                              upiAmount === String(amt)
                                ? "border-brand bg-brand/10 text-brand"
                                : "border-border bg-secondary text-muted-foreground hover:text-foreground"
                            )}
                          >
                            ₹{amt.toLocaleString("en-IN")}
                          </button>
                        ))}
                      </div>
                    </div>

                    {upiError && (
                      <div className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3">
                        <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                        <p className="text-xs text-destructive">{upiError}</p>
                      </div>
                    )}

                    <button
                      onClick={handleUpiPayin}
                      disabled={upiLoading || !upiAmount}
                      className="w-full rounded-lg bg-brand hover:bg-brand/90 text-primary-foreground font-semibold py-2.5 text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {upiLoading
                        ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating QR...</>
                        : <><QrCode className="h-4 w-4" /> Generate QR Code</>
                      }
                    </button>
                  </>
                )}

                {/* Payment link opened: next steps */}
                {upiPayin && (
                  <div className="space-y-5">
                    <div className="text-center">
                      <h3 className="text-base font-semibold text-foreground">Payment Ready</h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        Amount: <span className="font-mono font-semibold text-foreground">₹{upiAmount}</span>
                      </p>
                    </div>

                    {upiPayin.paymentLink && (
                      <a
                        href={upiPayin.paymentLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full flex items-center justify-center gap-2 rounded-lg bg-yes hover:bg-yes/90 text-primary-foreground font-semibold py-2.5 text-sm transition-colors"
                      >
                        <ExternalLink className="h-4 w-4" /> Open Payment Link
                      </a>
                    )}

                    <div className="rounded-lg border border-chart-4/30 bg-chart-4/10 p-4 space-y-1">
                      <p className="text-xs font-semibold text-chart-4">Next steps</p>
                      <p className="text-xs text-muted-foreground">
                        Complete your payment on the opened tab. Once done, go to <b className="text-foreground">Fund Requests</b> and click <b className="text-foreground">Payment Done</b> on the draft entry — enter your <b className="text-foreground">UTR number</b> to submit it for admin review.
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={resetUpi}
                        className="flex-1 rounded-lg border border-border bg-secondary py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Back
                      </button>
                      <Link
                        href="/merchant/fund-requests"
                        className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-brand hover:bg-brand/90 text-primary-foreground font-semibold py-2.5 text-sm transition-colors"
                      >
                        Go to Fund Requests <ArrowRight className="h-4 w-4" />
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ───── Crypto Tab ───── */}
            {fundTab === "crypto" && (
              <div className="space-y-5">
                <div>
                  <h3 className="text-base font-semibold text-foreground">Deposit via Crypto</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Send USDC or USDT to the wallet address below
                  </p>
                </div>

                {/* Network badge */}
                <div className="flex items-center gap-2 rounded-lg border border-brand/30 bg-brand/10 px-4 py-3">
                  <Bitcoin className="h-4 w-4 text-brand shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-foreground">Network</p>
                    <p className="text-sm font-mono text-brand">{CRYPTO_NETWORK}</p>
                  </div>
                </div>

                {/* Wallet address */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">Deposit Address</label>
                  <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-3">
                    <p className="flex-1 text-sm font-mono text-foreground break-all select-all">
                      {CRYPTO_WALLET}
                    </p>
                    <button
                      onClick={copyAddress}
                      className={cn(
                        "flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors shrink-0",
                        copied
                          ? "border-yes/30 bg-yes/10 text-yes"
                          : "border-border bg-secondary text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {copied ? <><Check className="h-3 w-3" /> Copied</> : <><Copy className="h-3 w-3" /> Copy</>}
                    </button>
                  </div>
                </div>

                {/* Instructions */}
                <div className="rounded-lg border border-chart-4/30 bg-chart-4/5 p-4 space-y-2">
                  <p className="text-xs font-semibold text-chart-4">Important</p>
                  <ul className="text-xs text-muted-foreground space-y-1.5 list-disc list-inside">
                    <li>Only send <b className="text-foreground">USDC</b> or <b className="text-foreground">USDT</b> on <b className="text-foreground">{CRYPTO_NETWORK}</b></li>
                    <li>Sending other tokens or using wrong network will result in permanent loss</li>
                    <li>Minimum deposit: <b className="text-foreground">$5</b></li>
                    <li>Funds will be credited after network confirmation (usually 2-5 minutes)</li>
                    <li>Contact support if funds are not credited within 30 minutes</li>
                  </ul>
                </div>
              </div>
            )}

            {/* ───── Card Tab ───── */}
            {fundTab === "card" && (
              <div className="space-y-5">

                {/* Idle: Card form */}
                {!cardPayin && (
                  <>
                    <div>
                      <h3 className="text-base font-semibold text-foreground">Add Funds via Card</h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        Fill in the details and complete payment on the secure NetPayShop page.
                      </p>
                    </div>

                    <div className="space-y-3">
                      <label className="text-xs font-medium text-muted-foreground">Amount</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-mono">$</span>
                        <input
                          type="number"
                          min={1}
                          step="0.01"
                          placeholder="Enter amount"
                          value={cardAmount}
                          onChange={(e) => { setCardAmount(e.target.value); setCardError(null); }}
                          className="w-full rounded-lg border border-border bg-background pl-7 pr-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-brand/40 focus:border-brand/40 transition-colors"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">Name</label>
                        <input
                          type="text"
                          value={cardName}
                          onChange={(e) => { setCardName(e.target.value); setCardError(null); }}
                          placeholder="Full name"
                          className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-brand/40 focus:border-brand/40 transition-colors"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">Email</label>
                        <input
                          type="email"
                          value={cardEmail}
                          onChange={(e) => { setCardEmail(e.target.value); setCardError(null); }}
                          placeholder="email@example.com"
                          className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-brand/40 focus:border-brand/40 transition-colors"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">Phone</label>
                        <input
                          type="tel"
                          value={cardPhone}
                          onChange={(e) => { setCardPhone(e.target.value); setCardError(null); }}
                          placeholder="Phone number"
                          className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-brand/40 focus:border-brand/40 transition-colors"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">Country</label>
                        <input
                          type="text"
                          value={cardCountry}
                          onChange={(e) => setCardCountry(e.target.value)}
                          placeholder="Country"
                          className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-brand/40 focus:border-brand/40 transition-colors"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">Address</label>
                        <input
                          type="text"
                          value={cardAddress}
                          onChange={(e) => setCardAddress(e.target.value)}
                          placeholder="Street address"
                          className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-brand/40 focus:border-brand/40 transition-colors"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">City</label>
                        <input
                          type="text"
                          value={cardCity}
                          onChange={(e) => setCardCity(e.target.value)}
                          placeholder="City"
                          className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-brand/40 focus:border-brand/40 transition-colors"
                        />
                      </div>
                    </div>

                    {cardError && (
                      <div className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3">
                        <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                        <p className="text-xs text-destructive">{cardError}</p>
                      </div>
                    )}

                    <button
                      onClick={handleCardPayin}
                      disabled={cardLoading || !cardAmount}
                      className="w-full rounded-lg bg-brand hover:bg-brand/90 text-primary-foreground font-semibold py-2.5 text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {cardLoading
                        ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating payment...</>
                        : <><CreditCard className="h-4 w-4" /> Proceed to Pay</>
                      }
                    </button>
                  </>
                )}

                {/* Payment page opened: next steps */}
                {cardPayin && (
                  <div className="space-y-5">
                    <div className="text-center">
                      <h3 className="text-base font-semibold text-foreground">Payment Ready</h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        Amount: <span className="font-mono font-semibold text-foreground">${cardAmount}</span>
                      </p>
                    </div>

                    {cardPayin.url && (
                      <a
                        href={cardPayin.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full flex items-center justify-center gap-2 rounded-lg bg-yes hover:bg-yes/90 text-primary-foreground font-semibold py-2.5 text-sm transition-colors"
                      >
                        <ExternalLink className="h-4 w-4" /> Open Payment Link
                      </a>
                    )}

                    <div className="rounded-lg border border-chart-4/30 bg-chart-4/10 p-4 space-y-1">
                      <p className="text-xs font-semibold text-chart-4">After payment</p>
                      <p className="text-xs text-muted-foreground">
                        Complete your payment on the opened tab, then submit a fund request with the <b className="text-foreground">transaction reference</b> from the payment receipt.
                        Admin will approve it and your wallet will be credited.
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={resetCard}
                        className="flex-1 rounded-lg border border-border bg-secondary py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Back
                      </button>
                      <Link
                        href="/merchant/fund-requests"
                        className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-brand hover:bg-brand/90 text-primary-foreground font-semibold py-2.5 text-sm transition-colors"
                      >
                        Submit Fund Request <ArrowRight className="h-4 w-4" />
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

    </div>
  );
}
