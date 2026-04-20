import { type NextRequest, NextResponse } from "next/server";

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const res = await fetch(`${BACKEND}/api/markets/${encodeURIComponent(id)}`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 60 },
    });
    if (!res.ok) return NextResponse.json(null, { status: res.status });
    const json = await res.json();
    // Backend wraps in { data: { market } } — unwrap for frontend
    return NextResponse.json(json?.data?.market ?? null);
  } catch {
    return NextResponse.json(null, { status: 500 });
  }
}
