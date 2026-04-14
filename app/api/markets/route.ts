import { type NextRequest, NextResponse } from "next/server";

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const query = new URLSearchParams();
  for (const [key, value] of searchParams.entries()) {
    query.set(key, value);
  }

  try {
    const res = await fetch(`${BACKEND}/api/polymarket/markets?${query.toString()}`, {
      headers: { "Accept": "application/json" },
      next: { revalidate: 60 },
    });

    if (!res.ok) return NextResponse.json([], { status: res.status });

    const data = await res.json();
    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" },
    });
  } catch (err) {
    console.error("[markets proxy] Backend error:", err);
    return NextResponse.json([], { status: 500 });
  }
}
