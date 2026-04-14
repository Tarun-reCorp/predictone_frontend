"use client";

import { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/header";
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Activity,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  FRED_INDICATORS,
  type FredSeriesData,
  formatFredValue,
  getFredChangeColor,
} from "@/lib/fred";
import { cn } from "@/lib/utils";

type IndicatorRecord = Record<string, FredSeriesData>;

const CATEGORIES = [
  { key: "all", label: "All Indicators" },
  { key: "growth", label: "Growth" },
  { key: "inflation", label: "Inflation" },
  { key: "labor", label: "Labor" },
  { key: "rates", label: "Rates" },
  { key: "markets", label: "Markets" },
  { key: "monetary", label: "Monetary" },
  { key: "housing", label: "Housing" },
  { key: "sentiment", label: "Sentiment" },
  { key: "currency", label: "Currency" },
];

function CustomTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: { value: number; color?: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-xl text-xs">
      <p className="text-muted-foreground mb-1">{label}</p>
      <p className="font-mono font-bold text-foreground">{payload[0]?.value?.toFixed(3)}</p>
    </div>
  );
}

function IndicatorCard({
  indicator,
  data,
  isSelected,
  onClick,
}: {
  indicator: (typeof FRED_INDICATORS)[number];
  data?: FredSeriesData;
  isSelected: boolean;
  onClick: () => void;
}) {
  const changeColor = getFredChangeColor(indicator.id, data?.changePct ?? null);
  const isUp = (data?.changePct ?? 0) > 0;
  const chartData = data?.observations.slice(-24).map((o) => ({
    date: o.date.slice(0, 7),
    value: parseFloat(o.value),
  })) ?? [];
  const unit = FRED_INDICATORS.find((i) => i.id === indicator.id)?.unit ?? "";
  const formattedValue = formatFredValue(data?.latestValue ?? null, unit);

  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-xl border bg-card p-4 text-left transition-all hover:border-brand/40 hover:bg-card/80",
        isSelected ? "border-brand/60 ring-1 ring-brand/20 bg-brand/5" : "border-border"
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <p className="text-xs text-muted-foreground">{indicator.label}</p>
          <p className="text-xl font-mono font-bold text-foreground mt-0.5">{formattedValue}</p>
        </div>
        <div className={cn("flex items-center gap-1 text-xs font-medium", changeColor)}>
          {data?.changePct !== null && data?.changePct !== undefined ? (
            <>
              {isUp ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
              {isUp ? "+" : ""}
              {data.changePct.toFixed(2)}%
            </>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </div>
      </div>

      {chartData.length > 0 && (
        <ResponsiveContainer width="100%" height={48}>
          <AreaChart data={chartData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={`grad-${indicator.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor={isUp ? "oklch(0.65 0.18 145)" : "oklch(0.58 0.22 25)"}
                  stopOpacity={0.3}
                />
                <stop
                  offset="95%"
                  stopColor={isUp ? "oklch(0.65 0.18 145)" : "oklch(0.58 0.22 25)"}
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="value"
              stroke={isUp ? "oklch(0.65 0.18 145)" : "oklch(0.58 0.22 25)"}
              strokeWidth={1.5}
              fill={`url(#grad-${indicator.id})`}
              dot={false}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}

      <p className="mt-2 text-xs text-muted-foreground truncate">{indicator.description}</p>
    </button>
  );
}

function DetailChart({
  indicator,
  data,
}: {
  indicator: (typeof FRED_INDICATORS)[number];
  data: FredSeriesData;
}) {
  const chartData = data.observations.map((o) => ({
    date: o.date.slice(0, 7),
    value: parseFloat(o.value),
  }));

  const unit = indicator.unit;
  const isUp = (data.changePct ?? 0) > 0;
  const changeColor = getFredChangeColor(indicator.id, data.changePct);
  const formattedLatest = formatFredValue(data.latestValue, unit);
  const formattedPrev = formatFredValue(data.previousValue, unit);
  const hasZero = chartData.some((d) => d.value < 0);

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <p className="text-xs text-muted-foreground mb-1">{indicator.description}</p>
          <h2 className="text-3xl font-mono font-bold text-foreground">{formattedLatest}</h2>
          <div className="flex items-center gap-3 mt-1.5">
            <span className={cn("flex items-center gap-1 text-sm font-medium", changeColor)}>
              {isUp ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              {data.change !== null ? (
                <>
                  {isUp ? "+" : ""}
                  {data.change.toFixed(3)} ({isUp ? "+" : ""}{data.changePct?.toFixed(2)}%)
                </>
              ) : "—"}
            </span>
            <span className="text-xs text-muted-foreground">
              prev: {formattedPrev}
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 text-right">
          <span className="text-xs text-muted-foreground">
            Updated: {data.series.last_updated?.slice(0, 10)}
          </span>
          <span className="text-xs text-muted-foreground">
            Freq: {data.series.frequency_short}
          </span>
          <a
            href={`https://fred.stlouisfed.org/series/${indicator.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-brand hover:underline"
          >
            View on FRED <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.22 0.008 240)" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: "oklch(0.55 0.01 240)" }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 10, fill: "oklch(0.55 0.01 240)", fontFamily: "monospace" }}
            tickLine={false}
            axisLine={false}
            width={55}
          />
          <Tooltip content={<CustomTooltip />} />
          {hasZero && (
            <ReferenceLine y={0} stroke="oklch(0.55 0.01 240)" strokeDasharray="4 4" />
          )}
          <Line
            type="monotone"
            dataKey="value"
            stroke="oklch(0.6 0.2 250)"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>

      {data.series.notes && (
        <p className="mt-4 text-xs text-muted-foreground leading-relaxed border-t border-border/50 pt-3">
          {data.series.notes.slice(0, 300)}
          {data.series.notes.length > 300 ? "..." : ""}
        </p>
      )}
    </div>
  );
}

export default function EconomicsPage() {
  const [category, setCategory] = useState("all");
  const [data, setData] = useState<IndicatorRecord>({});
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string>("FEDFUNDS");
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const ids = FRED_INDICATORS.map((i) => i.id).join(",");
      const res = await fetch(`/api/fred/bulk?ids=${ids}`);
      if (res.ok) {
        const json: IndicatorRecord = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error("[EconomicsPage] Failed to load FRED data:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const visibleIndicators =
    category === "all"
      ? FRED_INDICATORS
      : FRED_INDICATORS.filter((i) => i.category === category);

  const selectedIndicator = FRED_INDICATORS.find((i) => i.id === selectedId);
  const selectedData = data[selectedId];

  return (
    <div className="min-h-screen bg-background">
      <Header activeCategory="" onCategoryChange={() => {}} />

      <main className="mx-auto max-w-[1400px] px-4 py-6">
        {/* Page header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Activity className="h-6 w-6 text-brand" />
              Economics Dashboard
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Live economic indicators from the St. Louis Federal Reserve (FRED)
            </p>
          </div>
          <button
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:border-brand/40 transition-all disabled:opacity-50"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
            Refresh
          </button>
        </div>

        {/* Category filter */}
        <div className="flex gap-2 mb-6 overflow-x-auto no-scrollbar pb-1">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              onClick={() => setCategory(cat.key)}
              className={cn(
                "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-all",
                category === cat.key
                  ? "bg-brand text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80"
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="flex gap-5">
          {/* Indicator grid */}
          <div className="flex-1 min-w-0">
            {loading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="rounded-xl border border-border bg-card h-36 animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                {visibleIndicators.map((indicator) => (
                  <IndicatorCard
                    key={indicator.id}
                    indicator={indicator}
                    data={data[indicator.id]}
                    isSelected={selectedId === indicator.id}
                    onClick={() => setSelectedId(indicator.id)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Detail panel */}
          <div className="hidden xl:block w-96 shrink-0">
            <div className="sticky top-4 space-y-4">
              {selectedIndicator && selectedData ? (
                <DetailChart indicator={selectedIndicator} data={selectedData} />
              ) : selectedIndicator && loading ? (
                <div className="rounded-xl border border-border bg-card h-80 animate-pulse" />
              ) : (
                <div className="rounded-xl border border-border bg-card p-8 text-center">
                  <Activity className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">Select an indicator to view the full chart</p>
                </div>
              )}

              {/* Summary stats */}
              {Object.keys(data).length > 0 && (
                <div className="rounded-xl border border-border bg-card p-4">
                  <h3 className="text-sm font-semibold text-foreground mb-3">Quick Summary</h3>
                  <div className="space-y-2">
                    {[
                      { id: "FEDFUNDS", label: "Fed Rate" },
                      { id: "UNRATE", label: "Unemployment" },
                      { id: "CPIAUCSL", label: "CPI" },
                      { id: "T10Y2Y", label: "Yield Curve" },
                    ].map(({ id, label }) => {
                      const d = data[id];
                      const ind = FRED_INDICATORS.find((i) => i.id === id);
                      if (!d || !ind) return null;
                      const color = getFredChangeColor(id, d.changePct);
                      return (
                        <div key={id} className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">{label}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-bold text-foreground">
                              {formatFredValue(d.latestValue, ind.unit)}
                            </span>
                            <span className={cn("text-xs font-mono", color)}>
                              {d.changePct !== null
                                ? `${d.changePct > 0 ? "+" : ""}${d.changePct.toFixed(2)}%`
                                : "—"}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="rounded-xl border border-brand/20 bg-brand/5 p-4">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Data sourced from the{" "}
                  <a
                    href="https://fred.stlouisfed.org"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand hover:underline"
                  >
                    Federal Reserve Bank of St. Louis (FRED)
                  </a>
                  . Updated hourly. All data is for informational purposes only.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
