import { type NextRequest, NextResponse } from "next/server";

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const market = searchParams.get("market") ?? searchParams.get("token_id");
  const interval = searchParams.get("interval") ?? "1w";
  const fidelity = searchParams.get("fidelity") ?? "60";

  if (!market) return NextResponse.json({ history: [] }, { status: 400 });

  try {
    const res = await fetch(
      `${BACKEND}/api/polymarket/prices?market=${encodeURIComponent(market)}&interval=${interval}&fidelity=${fidelity}`,
      { headers: { "Accept": "application/json" }, next: { revalidate: 60 } }
    );

    if (!res.ok) return NextResponse.json({ history: [] });

    const data = await res.json();
    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" },
    });
  } catch (err) {
    console.error("[prices proxy] Backend error:", err);
    return NextResponse.json({ history: [] });
  }
}
