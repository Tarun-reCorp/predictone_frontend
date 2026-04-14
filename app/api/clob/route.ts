import { type NextRequest, NextResponse } from "next/server";

const CLOB_API = "https://clob.polymarket.com";

// Public CLOB endpoints that don't require L1 auth
const PUBLIC_ENDPOINTS = new Set([
  "prices-history",
  "book",
  "midpoints",
  "spread",
  "last-trade-price",
  "markets",
  "sampling-markets",
  "sampling-simplified-markets",
  "simplified-markets",
  "tick-sizes",
  "neg-risk",
]);

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const endpoint = searchParams.get("endpoint");

  if (!endpoint || !PUBLIC_ENDPOINTS.has(endpoint)) {
    return NextResponse.json(
      { error: "Invalid or unauthorized endpoint. Only public read-only CLOB endpoints are supported." },
      { status: 400 }
    );
  }

  // Forward remaining params to CLOB
  const forwardParams = new URLSearchParams();
  for (const [key, value] of searchParams.entries()) {
    if (key !== "endpoint") forwardParams.set(key, value);
  }

  const url = `${CLOB_API}/${endpoint}?${forwardParams.toString()}`;

  try {
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "PredictOne/1.0",
      },
      next: { revalidate: endpoint === "prices-history" ? 60 : 10 },
    });

    if (!res.ok) {
      return NextResponse.json({ error: `CLOB API returned ${res.status}` }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": `public, s-maxage=${endpoint === "prices-history" ? 60 : 10}, stale-while-revalidate=120`,
      },
    });
  } catch (err) {
    console.error("[v0] CLOB proxy error:", err);
    return NextResponse.json({ error: "Failed to fetch from CLOB API" }, { status: 500 });
  }
}
