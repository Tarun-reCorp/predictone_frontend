"use client";

import { useEffect, useState, useRef } from "react";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { Play, Pause, RotateCcw, Plus, Trash2, FlaskConical } from "lucide-react";
import { generateSimMarkets, tickMarket, type SimMarket } from "@/lib/simulation";
import { formatVolume } from "@/lib/polymarket";
import { cn } from "@/lib/utils";

export default function AdminSimulation() {
  const [markets, setMarkets] = useState<SimMarket[]>([]);
  const [selected, setSelected] = useState<SimMarket | null>(null);
  const [running, setRunning] = useState(false);
  const [tick, setTick] = useState(0);
  const [log, setLog] = useState<string[]>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const init = () => {
    const m = generateSimMarkets(12);
    setMarkets(m);
    setSelected(m[0] ?? null);
    setTick(0);
    setLog([`[${new Date().toLocaleTimeString()}] Simulation initialized with ${m.length} markets.`]);
    setRunning(false);
  };

  useEffect(() => { init(); }, []);

  useEffect(() => {
    if (!running) { if (intervalRef.current) clearInterval(intervalRef.current); return; }
    intervalRef.current = setInterval(() => {
      setMarkets((prev) => {
        const updated = prev.map((m) => {
          const next = tickMarket(m);
          const pctChange = Math.abs(next.yesProbability - m.yesProbability);
          if (pctChange > 0.04) {
            const dir = next.yesProbability > m.yesProbability ? "surged" : "dropped";
            setLog((l) => [`[${new Date().toLocaleTimeString()}] ${next.question.slice(0, 40)}... Yes ${dir} to ${(next.yesProbability * 100).toFixed(1)}%`, ...l].slice(0, 50));
          }
          return next;
        });
        setSelected((prev) => {
          if (!prev) return updated[0] ?? null;
          return updated.find((m) => m.id === prev.id) ?? prev;
        });
        return updated;
      });
      setTick((t) => t + 1);
    }, 1200);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running]);

  const addMarket = () => {
    const [newM] = generateSimMarkets(1);
    setMarkets((prev) => [...prev, newM]);
    setLog((l) => [`[${new Date().toLocaleTimeString()}] New market created: ${newM.question.slice(0, 50)}...`, ...l]);
  };

  const removeMarket = (id: string) => {
    setMarkets((prev) => prev.filter((m) => m.id !== id));
    if (selected?.id === id) setSelected(markets.find((m) => m.id !== id) ?? null);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Simulation Engine</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {markets.length} simulated markets — tick #{tick}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={addMarket} className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
            <Plus className="h-3.5 w-3.5" /> Add Market
          </button>
          <button onClick={init} className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
            <RotateCcw className="h-3.5 w-3.5" /> Reset
          </button>
          <button
            onClick={() => setRunning(!running)}
            className={cn(
              "flex items-center gap-1.5 rounded-lg border px-4 py-1.5 text-xs font-semibold transition-colors",
              running ? "border-no/40 bg-no/10 text-no" : "border-yes/40 bg-yes/10 text-yes"
            )}
          >
            {running ? <><Pause className="h-3.5 w-3.5" /> Pause</> : <><Play className="h-3.5 w-3.5" /> Run</>}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Market list */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">Markets ({markets.length})</p>
            <FlaskConical className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="divide-y divide-border/50 max-h-[480px] overflow-y-auto">
            {markets.map((m) => {
              const yes = Math.round(m.yesProbability * 100);
              return (
                <div
                  key={m.id}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-secondary/30",
                    selected?.id === m.id ? "bg-brand/10 border-l-2 border-l-brand" : ""
                  )}
                  onClick={() => setSelected(m)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{m.question}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{m.category} · {formatVolume(m.volume)}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="text-xs font-bold font-mono text-yes">{yes}%</span>
                    <div className="w-12 h-1 rounded-full bg-secondary overflow-hidden">
                      <div className="h-full bg-yes rounded-full transition-all" style={{ width: `${yes}%` }} />
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeMarket(m.id); }}
                    className="text-muted-foreground hover:text-no transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected market detail */}
        <div className="lg:col-span-2 space-y-4">
          {selected ? (
            <>
              <div className="rounded-xl border border-border bg-card p-5">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-sm font-bold text-foreground leading-snug">{selected.question}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{selected.category} · Tick #{tick}</p>
                  </div>
                  <div className="text-right shrink-0 ml-4">
                    <p className="text-2xl font-bold font-mono text-yes">{(selected.yesProbability * 100).toFixed(1)}%</p>
                    <p className="text-xs text-muted-foreground">Yes probability</p>
                  </div>
                </div>
                {/* Stats row */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                  {[
                    { label: "Volume", value: formatVolume(selected.volume) },
                    { label: "Liquidity", value: formatVolume(selected.liquidity) },
                    { label: "Trades", value: String(selected.tradeCount) },
                  ].map((s) => (
                    <div key={s.label} className="rounded-lg bg-secondary/50 p-3 text-center">
                      <p className="text-xs text-muted-foreground">{s.label}</p>
                      <p className="text-sm font-bold font-mono text-foreground mt-0.5">{s.value}</p>
                    </div>
                  ))}
                </div>
                {/* Price chart from history */}
                {selected.priceHistory.length > 1 && (
                  <ResponsiveContainer width="100%" height={140}>
                    <LineChart
                      data={selected.priceHistory.slice(-60).map((p, i) => ({ t: i, price: Math.round(p * 100) }))}
                      margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
                    >
                      <XAxis hide />
                      <YAxis tick={{ fill: "oklch(0.55 0.01 240)", fontSize: 10 }} axisLine={false} tickLine={false} domain={[0, 100]} tickFormatter={(v) => `$${(v / 100).toFixed(2)}`} />
                      <Tooltip
                        contentStyle={{ background: "oklch(0.16 0.006 240)", border: "1px solid oklch(0.22 0.008 240)", borderRadius: 8, fontSize: 11 }}
                        formatter={(v: number) => [`$${(v / 100).toFixed(2)}`, "Yes Price"]}
                      />
                      <Line type="monotone" dataKey="price" stroke="oklch(0.65 0.18 145)" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* All market snapshot */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {markets.slice(0, 6).map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setSelected(m)}
                    className={cn(
                      "rounded-xl border p-3 text-left transition-all hover:border-brand/40",
                      selected.id === m.id ? "border-brand/60 bg-brand/5" : "border-border bg-card"
                    )}
                  >
                    <p className="text-[10px] text-muted-foreground truncate">{m.category}</p>
                    <p className="text-xs font-medium text-foreground truncate mt-0.5 leading-snug">{m.question.slice(0, 40)}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-sm font-bold font-mono text-yes">{(m.yesProbability * 100).toFixed(0)}%</span>
                      <div className="flex-1 h-1 rounded-full bg-secondary overflow-hidden">
                        <div className="h-full bg-yes rounded-full transition-all" style={{ width: `${m.yesProbability * 100}%` }} />
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-border bg-card p-10 text-center text-muted-foreground text-sm">
              Select a market to view details
            </div>
          )}
        </div>
      </div>

      {/* Event log */}
      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <p className="text-sm font-semibold text-foreground">Simulation Log</p>
          <button onClick={() => setLog([])} className="text-xs text-muted-foreground hover:text-foreground transition-colors">Clear</button>
        </div>
        <div className="max-h-40 overflow-y-auto p-4 space-y-1">
          {log.length === 0 ? (
            <p className="text-xs text-muted-foreground">No events yet.</p>
          ) : log.map((l, i) => (
            <p key={i} className="text-[11px] font-mono text-muted-foreground">{l}</p>
          ))}
        </div>
      </div>
    </div>
  );
}
