import { type NextRequest, NextResponse } from "next/server";

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  // Forward all query params to backend
  const query = new URLSearchParams();
  for (const [key, value] of searchParams.entries()) {
    query.append(key, value);
  }

  try {
    const res = await fetch(`${BACKEND}/api/polymarket/clob?${query.toString()}`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 10 },
    });

    if (!res.ok) {
      return NextResponse.json({ error: `Backend returned ${res.status}` }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, s-maxage=10, stale-while-revalidate=60" },
    });
  } catch (err) {
    console.error("[clob proxy] Backend error:", err);
    return NextResponse.json({ error: "Failed to fetch CLOB data" }, { status: 500 });
  }
}
