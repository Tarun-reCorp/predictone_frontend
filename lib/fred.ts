// FRED (Federal Reserve Economic Data) API client
// Docs: https://fred.stlouisfed.org/docs/api/fred/

const FRED_BASE = "https://api.stlouisfed.org/fred";

export interface FredSeries {
  id: string;
  realtime_start: string;
  realtime_end: string;
  title: string;
  observation_start: string;
  observation_end: string;
  frequency: string;
  frequency_short: string;
  units: string;
  units_short: string;
  seasonal_adjustment: string;
  last_updated: string;
  popularity: number;
  notes?: string;
}

export interface FredObservation {
  realtime_start: string;
  realtime_end: string;
  date: string;
  value: string;
}

export interface FredSeriesData {
  series: FredSeries;
  observations: FredObservation[];
  latestValue: number | null;
  previousValue: number | null;
  change: number | null;
  changePct: number | null;
}

export interface FredRelease {
  id: number;
  name: string;
  press_release: boolean;
  link?: string;
}

// Key economic indicators we track
export const FRED_INDICATORS = [
  { id: "GDP", label: "GDP", description: "Gross Domestic Product", category: "growth", unit: "Bil. $" },
  { id: "CPIAUCSL", label: "CPI", description: "Consumer Price Index", category: "inflation", unit: "Index" },
  { id: "UNRATE", label: "Unemployment", description: "Unemployment Rate", category: "labor", unit: "%" },
  { id: "FEDFUNDS", label: "Fed Funds Rate", description: "Federal Funds Effective Rate", category: "rates", unit: "%" },
  { id: "T10Y2Y", label: "Yield Curve", description: "10-Year minus 2-Year Treasury", category: "rates", unit: "%" },
  { id: "DGS10", label: "10-Yr Treasury", description: "10-Year Treasury Constant Maturity Rate", category: "rates", unit: "%" },
  { id: "SP500", label: "S&P 500", description: "S&P 500 Index", category: "markets", unit: "Index" },
  { id: "DTWEXBGS", label: "USD Index", description: "Trade Weighted U.S. Dollar Index", category: "currency", unit: "Index" },
  { id: "UMCSENT", label: "Consumer Sentiment", description: "U of Michigan Consumer Sentiment", category: "sentiment", unit: "Index" },
  { id: "PCEPI", label: "PCE Inflation", description: "Personal Consumption Expenditures Price Index", category: "inflation", unit: "Index" },
  { id: "M2SL", label: "M2 Money Supply", description: "M2 Money Stock", category: "monetary", unit: "Bil. $" },
  { id: "HOUST", label: "Housing Starts", description: "Housing Starts: Total New Privately Owned", category: "housing", unit: "Thousands" },
] as const;

export type FredIndicatorId = (typeof FRED_INDICATORS)[number]["id"];

// Server-side: fetch a single series + recent observations
export async function fetchFredSeries(
  seriesId: string,
  limit = 24
): Promise<FredSeriesData | null> {
  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) {
    console.error("[FRED] FRED_API_KEY not set");
    return null;
  }

  const [seriesRes, obsRes] = await Promise.all([
    fetch(
      `${FRED_BASE}/series?series_id=${seriesId}&api_key=${apiKey}&file_type=json`,
      { next: { revalidate: 3600 } }
    ),
    fetch(
      `${FRED_BASE}/series/observations?series_id=${seriesId}&api_key=${apiKey}&file_type=json&sort_order=desc&limit=${limit}&observation_start=2020-01-01`,
      { next: { revalidate: 3600 } }
    ),
  ]);

  if (!seriesRes.ok || !obsRes.ok) return null;

  const seriesJson = await seriesRes.json();
  const obsJson = await obsRes.json();

  const series: FredSeries = seriesJson.seriess?.[0];
  if (!series) return null;

  const observations: FredObservation[] = (obsJson.observations ?? []).filter(
    (o: FredObservation) => o.value !== "." && o.value !== ""
  );

  // Sorted oldest-first for charts
  const sorted = [...observations].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const latestValue = sorted.length > 0 ? parseFloat(sorted[sorted.length - 1].value) : null;
  const previousValue = sorted.length > 1 ? parseFloat(sorted[sorted.length - 2].value) : null;
  const change = latestValue !== null && previousValue !== null ? latestValue - previousValue : null;
  const changePct =
    change !== null && previousValue !== null && previousValue !== 0
      ? (change / Math.abs(previousValue)) * 100
      : null;

  return { series, observations: sorted, latestValue, previousValue, change, changePct };
}

// Server-side: fetch multiple series
export async function fetchFredMultiple(
  ids: readonly string[]
): Promise<Record<string, FredSeriesData>> {
  const results = await Promise.all(ids.map((id) => fetchFredSeries(id, 36)));
  const out: Record<string, FredSeriesData> = {};
  ids.forEach((id, i) => {
    if (results[i]) out[id] = results[i]!;
  });
  return out;
}

// Format FRED values for display
export function formatFredValue(value: number | null, unit: string): string {
  if (value === null) return "N/A";
  if (unit === "%") return `${value.toFixed(2)}%`;
  if (unit.includes("Bil")) {
    if (value >= 1000) return `$${(value / 1000).toFixed(1)}T`;
    return `$${value.toFixed(0)}B`;
  }
  if (unit === "Thousands") return `${value.toFixed(0)}K`;
  if (unit === "Index") return value.toFixed(2);
  return value.toFixed(2);
}

// Color classes based on whether change is good/bad for that indicator
export function getFredChangeColor(
  indicatorId: string,
  changePct: number | null
): string {
  if (changePct === null) return "text-muted-foreground";
  const NEGATIVE_GOOD = ["UNRATE", "CPIAUCSL", "PCEPI"]; // lower = better
  const isGood = NEGATIVE_GOOD.includes(indicatorId) ? changePct < 0 : changePct > 0;
  return isGood ? "text-yes" : "text-no";
}
