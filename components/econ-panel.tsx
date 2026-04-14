"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TrendingUp, TrendingDown, ArrowUpRight, Activity } from "lucide-react";
import { AreaChart, Area, ResponsiveContainer } from "recharts";
import {
  FRED_INDICATORS,
  type FredSeriesData,
  formatFredValue,
  getFredChangeColor,
} from "@/lib/fred";
import { cn } from "@/lib/utils";

type IndicatorRecord = Record<string, FredSeriesData>;

// The key indicators to show in the compact sidebar panel
const SIDEBAR_IDS = ["FEDFUNDS", "UNRATE", "CPIAUCSL", "T10Y2Y", "SP500", "DTWEXBGS"] as const;

export function EconPanel() {
  const [data, setData] = useState<IndicatorRecord>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        const ids = SIDEBAR_IDS.join(",");
        const res = await fetch(`/api/fred/bulk?ids=${ids}`, { signal: controller.signal });
        if (res.ok) {
          const json: IndicatorRecord = await res.json();
          setData(json);
        }
      } catch {
        // silently fail — sidebar is non-critical (also catches AbortError)
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    load();

    return () => controller.abort();
  }, []);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          <Activity className="h-3.5 w-3.5 text-brand" />
          <h3 className="text-sm font-semibold text-foreground">Economic Indicators</h3>
        </div>
        <Link
          href="/economics"
          className="flex items-center gap-0.5 text-xs text-brand hover:underline"
        >
          Full view <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>

      {/* Indicator rows */}
      <div className="divide-y divide-border/30">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <div className="h-3 w-20 rounded bg-secondary animate-pulse" />
                <div className="ml-auto h-3 w-12 rounded bg-secondary animate-pulse" />
              </div>
            ))
          : SIDEBAR_IDS.map((id) => {
              const d = data[id];
              const indicator = FRED_INDICATORS.find((i) => i.id === id);
              if (!indicator) return null;

              const changeColor = getFredChangeColor(id, d?.changePct ?? null);
              const isUp = (d?.changePct ?? 0) > 0;
              const formattedValue = formatFredValue(d?.latestValue ?? null, indicator.unit);
              const miniChart = d?.observations
                .slice(-10)
                .map((o) => ({ v: parseFloat(o.value) })) ?? [];

              return (
                <Link
                  key={id}
                  href={`/economics#${id}`}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-secondary/30 transition-colors group"
                >
                  {/* Label */}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-foreground truncate group-hover:text-primary/90">
                      {indicator.label}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{indicator.description.slice(0, 28)}...</p>
                  </div>

                  {/* Sparkline */}
                  {miniChart.length > 0 && (
                    <div className="w-14 h-7 shrink-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={miniChart} margin={{ top: 1, right: 0, left: 0, bottom: 1 }}>
                          <defs>
                            <linearGradient id={`sg-${id}`} x1="0" y1="0" x2="0" y2="1">
                              <stop
                                offset="5%"
                                stopColor={
                                  isUp ? "oklch(0.65 0.18 145)" : "oklch(0.58 0.22 25)"
                                }
                                stopOpacity={0.25}
                              />
                              <stop
                                offset="95%"
                                stopColor={
                                  isUp ? "oklch(0.65 0.18 145)" : "oklch(0.58 0.22 25)"
                                }
                                stopOpacity={0}
                              />
                            </linearGradient>
                          </defs>
                          <Area
                            type="monotone"
                            dataKey="v"
                            stroke={isUp ? "oklch(0.65 0.18 145)" : "oklch(0.58 0.22 25)"}
                            strokeWidth={1.5}
                            fill={`url(#sg-${id})`}
                            dot={false}
                            isAnimationActive={false}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {/* Value + change */}
                  <div className="shrink-0 text-right">
                    <p className="text-xs font-mono font-bold text-foreground">{formattedValue}</p>
                    <p className={cn("text-xs font-mono flex items-center justify-end gap-0.5", changeColor)}>
                      {d?.changePct !== null && d?.changePct !== undefined ? (
                        <>
                          {isUp ? (
                            <TrendingUp className="h-2.5 w-2.5" />
                          ) : (
                            <TrendingDown className="h-2.5 w-2.5" />
                          )}
                          {isUp ? "+" : ""}
                          {d.changePct.toFixed(2)}%
                        </>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </p>
                  </div>
                </Link>
              );
            })}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-border/50">
        <p className="text-xs text-muted-foreground/60 text-center">
          Source: Federal Reserve Bank of St. Louis
        </p>
      </div>
    </div>
  );
}
