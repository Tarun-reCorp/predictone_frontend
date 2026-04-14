// GET /api/fred/bulk?ids=GDP,UNRATE,FEDFUNDS
// Fetches multiple FRED series in one request
import { NextRequest, NextResponse } from "next/server";
import { fetchFredMultiple } from "@/lib/fred";

export async function GET(req: NextRequest) {
  const idsParam = req.nextUrl.searchParams.get("ids");

  if (!idsParam) {
    return NextResponse.json({ error: "Missing ids param" }, { status: 400 });
  }

  const ids = idsParam.split(",").map((s) => s.trim()).filter(Boolean);
  if (ids.length === 0) {
    return NextResponse.json({ error: "No valid ids" }, { status: 400 });
  }
  if (ids.length > 15) {
    return NextResponse.json({ error: "Max 15 ids per request" }, { status: 400 });
  }

  const data = await fetchFredMultiple(ids);

  return NextResponse.json(data, {
    headers: { "Cache-Control": "s-maxage=3600, stale-while-revalidate=300" },
  });
}
