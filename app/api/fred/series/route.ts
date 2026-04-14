// GET /api/fred/series?id=FEDFUNDS&limit=24
// Server-side proxy for FRED series + observations (avoids CORS + hides API key)
import { NextRequest, NextResponse } from "next/server";
import { fetchFredSeries } from "@/lib/fred";

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  const limit = parseInt(req.nextUrl.searchParams.get("limit") ?? "36", 10);

  if (!id) {
    return NextResponse.json({ error: "Missing id param" }, { status: 400 });
  }

  const data = await fetchFredSeries(id, limit);
  if (!data) {
    return NextResponse.json({ error: "Series not found" }, { status: 404 });
  }

  return NextResponse.json(data, {
    headers: { "Cache-Control": "s-maxage=3600, stale-while-revalidate=300" },
  });
}
