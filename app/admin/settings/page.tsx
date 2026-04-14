"use client";

import { useState } from "react";
import { CheckCircle2, Key, Globe, Database, Zap, Shield, Copy, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface SettingRow { label: string; value: string; masked?: boolean; status: "ok" | "warn" | "error" }

function Section({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-border bg-secondary/20">
        <Icon className="h-4 w-4 text-brand" />
        <p className="text-sm font-semibold text-foreground">{title}</p>
      </div>
      <div className="divide-y divide-border/50">{children}</div>
    </div>
  );
}

function SettingRow({ label, value, masked, status }: SettingRow) {
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const display = masked && !show ? value.slice(0, 6) + "••••••••••••••••" : value;

  return (
    <div className="flex items-center justify-between px-5 py-3.5 hover:bg-secondary/10 transition-colors">
      <div className="flex items-center gap-3">
        <div className={cn("h-2 w-2 rounded-full shrink-0", status === "ok" ? "bg-yes" : status === "warn" ? "bg-chart-4" : "bg-no")} />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs text-foreground">{display}</span>
        {masked && (
          <button onClick={() => setShow(!show)} className="text-[10px] text-muted-foreground hover:text-foreground transition-colors px-1.5 py-0.5 rounded border border-border">
            {show ? "Hide" : "Show"}
          </button>
        )}
        <button onClick={copy} className="text-muted-foreground hover:text-foreground transition-colors">
          {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-yes" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );
}

export default function AdminSettings() {
  const [testResult, setTestResult] = useState<Record<string, "idle" | "testing" | "ok" | "error">>({
    gamma: "idle", clob: "idle", fred: "idle",
  });

  const testEndpoint = async (key: string, url: string) => {
    setTestResult((prev) => ({ ...prev, [key]: "testing" }));
    try {
      const res = await fetch(url);
      setTestResult((prev) => ({ ...prev, [key]: res.ok ? "ok" : "error" }));
    } catch {
      setTestResult((prev) => ({ ...prev, [key]: "error" }));
    }
  };

  const ENDPOINTS = [
    { key: "gamma", label: "Gamma API (Polymarket)", url: "/api/markets?limit=1" },
    { key: "clob", label: "CLOB API (Polymarket)", url: "/api/prices?market=0xd8fc55155395d7c2083725edaebbd0e49d13fad1500ce7c007617cc00869573d&interval=1w" },
    { key: "fred", label: "FRED API (St. Louis Fed)", url: "/api/fred/bulk?ids=FEDFUNDS" },
  ];

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">API configuration, credentials, and system health</p>
      </div>

      {/* API Keys */}
      <Section title="API Credentials" icon={Key}>
        <SettingRow label="FRED API Key" value="603575b810dbcd791f0437869b32b399" masked status="ok" />
        <SettingRow label="Polymarket Gamma API" value="https://gamma-api.polymarket.com" status="ok" />
        <SettingRow label="Polymarket CLOB API" value="https://clob.polymarket.com" status="ok" />
        <SettingRow label="Polymarket Data API" value="https://data-api.polymarket.com" status="ok" />
      </Section>

      {/* Proxy routes */}
      <Section title="Proxy API Routes" icon={Globe}>
        <SettingRow label="Markets proxy" value="/api/markets" status="ok" />
        <SettingRow label="Prices proxy" value="/api/prices" status="ok" />
        <SettingRow label="CLOB proxy" value="/api/clob" status="ok" />
        <SettingRow label="Leaderboard proxy" value="/api/leaderboard" status="ok" />
        <SettingRow label="FRED series proxy" value="/api/fred/series" status="ok" />
        <SettingRow label="FRED bulk proxy" value="/api/fred/bulk" status="ok" />
      </Section>

      {/* Endpoint health tests */}
      <Section title="Endpoint Health" icon={Zap}>
        <div className="p-5 space-y-3">
          {ENDPOINTS.map((ep) => (
            <div key={ep.key} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "h-2 w-2 rounded-full shrink-0",
                  testResult[ep.key] === "ok" ? "bg-yes" :
                  testResult[ep.key] === "error" ? "bg-no" :
                  testResult[ep.key] === "testing" ? "bg-chart-4 animate-pulse" :
                  "bg-muted-foreground/40"
                )} />
                <span className="text-xs text-muted-foreground">{ep.label}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn("text-[10px] font-semibold",
                  testResult[ep.key] === "ok" ? "text-yes" :
                  testResult[ep.key] === "error" ? "text-no" :
                  testResult[ep.key] === "testing" ? "text-chart-4" :
                  "text-muted-foreground"
                )}>
                  {testResult[ep.key] === "idle" ? "Not tested" :
                   testResult[ep.key] === "testing" ? "Testing..." :
                   testResult[ep.key] === "ok" ? "Healthy" : "Failed"}
                </span>
                <button
                  onClick={() => testEndpoint(ep.key, ep.url)}
                  disabled={testResult[ep.key] === "testing"}
                  className="flex items-center gap-1 rounded border border-border px-2 py-1 text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={cn("h-3 w-3", testResult[ep.key] === "testing" && "animate-spin")} />
                  Test
                </button>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Data sources */}
      <Section title="Data Sources" icon={Database}>
        {[
          { label: "Polymarket Gamma API", desc: "Markets, events, tags, search", status: "ok" as const },
          { label: "Polymarket CLOB API", desc: "Price history, order book (public endpoints)", status: "ok" as const },
          { label: "Polymarket Data API", desc: "Leaderboard, trades (public endpoints)", status: "ok" as const },
          { label: "FRED API", desc: "12 economic indicators — Fed Funds, CPI, GDP, etc.", status: "ok" as const },
        ].map((s) => (
          <div key={s.label} className="flex items-center justify-between px-5 py-3.5 hover:bg-secondary/10 transition-colors">
            <div className="flex items-center gap-3">
              <div className={cn("h-2 w-2 rounded-full shrink-0", s.status === "ok" ? "bg-yes" : "bg-no")} />
              <div>
                <p className="text-xs font-medium text-foreground">{s.label}</p>
                <p className="text-[10px] text-muted-foreground">{s.desc}</p>
              </div>
            </div>
            <span className={cn("text-[10px] font-semibold", s.status === "ok" ? "text-yes" : "text-no")}>
              {s.status === "ok" ? "Connected" : "Error"}
            </span>
          </div>
        ))}
      </Section>

      {/* Auth note */}
      <Section title="Authentication" icon={Shield}>
        <div className="px-5 py-4">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Trading endpoints on the Polymarket CLOB API require L1 (Ethereum wallet signature) authentication.
            PredictOne currently uses only{" "}
            <span className="text-foreground font-semibold">public read-only endpoints</span> — no authentication is required for browsing markets, price history, or the order book.
          </p>
          <div className="mt-4 rounded-lg border border-border bg-secondary/50 px-4 py-3 text-xs text-muted-foreground">
            <p className="font-semibold text-foreground mb-1">To enable order placement:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Generate an Ethereum wallet private key</li>
              <li>Call <code className="font-mono text-brand">POST /auth/derive-api-key</code> with an EIP-712 signed payload</li>
              <li>Store the returned API key + secret as environment variables</li>
              <li>Pass <code className="font-mono text-brand">POLY_API_KEY</code> in the <code className="font-mono text-brand">POLY-API-KEY</code> header</li>
            </ol>
          </div>
        </div>
      </Section>
    </div>
  );
}
