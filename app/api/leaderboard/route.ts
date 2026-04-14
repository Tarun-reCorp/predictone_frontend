import { type NextRequest, NextResponse } from "next/server";

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = searchParams.get("limit") ?? "10";
  const window = searchParams.get("window") ?? "monthly";

  try {
    const res = await fetch(
      `${BACKEND}/api/polymarket/leaderboard?limit=${limit}&window=${window}`,
      { headers: { "Accept": "application/json" }, next: { revalidate: 300 } }
    );

    if (!res.ok) return NextResponse.json([], { status: res.status });

    const data = await res.json();
    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
    });
  } catch (err) {
    console.error("[leaderboard proxy] Backend error:", err);
    return NextResponse.json([], { status: 500 });
  }
}
