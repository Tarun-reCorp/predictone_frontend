"use client";

import { useEffect, useState } from "react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import {
  TrendingUp, TrendingDown, Users, Activity, Droplets,
  ArrowUpRight, ArrowDownRight, RefreshCw, Clock,
  ShoppingBag, ArrowUpDown, ChevronLeft, ChevronRight,
  Hash, DollarSign, CheckCheck, Timer, Receipt, XCircle,
  CheckCircle2, AlertCircle,
} from "lucide-react";
import { clientFetchMarkets, formatVolume, type PolyMarket } from "@/lib/polymarket";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import { useWalletContext } from "@/contexts/wallet-context";

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

// ── Types ──────────────────────────────────────────────────────────────────────

interface AdminOrder {
  _id: string;
  merchantId?: { name?: string; email?: string } | string;
  conditionId: string;
  marketQuestion?: string;
  outcome: "Yes" | "No";
  side: "buy" | "sell";
  amount: number;
  price: number;
  status: "pending" | "submitted" | "matched" | "settled" | "failed" | "cancelled";
  createdAt: string;
}

interface AdminTransaction {
  _id: string;
  merchantId?: { name?: string; email?: string } | string;
  type: string;
  amount: number;
  currency: string;
  status: "pending" | "confirmed" | "failed";
  description?: string;
  createdAt: string;
}

// ── Badge colour maps ──────────────────────────────────────────────────────────

const ORDER_STATUS_STYLE: Record<string, string> = {
  pending:   "bg-chart-4/15 text-chart-4",
  submitted: "bg-blue-500/15 text-blue-400",
  matched:   "bg-brand/15 text-brand",
  settled:   "bg-yes/15 text-yes",
  failed:    "bg-no/15 text-no",
  cancelled: "bg-muted-foreground/15 text-muted-foreground",
};

const TX_STATUS_STYLE: Record<string, string> = {
  pending:   "bg-chart-4/15 text-chart-4",
  confirmed: "bg-yes/15 text-yes",
  failed:    "bg-no/15 text-no",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}
function fmtAmount(n: number) { return `$${n.toFixed(2)}`; }

// ── Shared sub-components ──────────────────────────────────────────────────────

function SummaryCard({
  icon: Icon, label, value, accent, bg,
}: { icon: React.ElementType; label: string; value: string; accent: string; bg: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
      <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg shrink-0", bg)}>
        <Icon className={cn("h-4 w-4", accent)} />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={cn("text-lg font-bold font-mono mt-0.5", accent)}>{value}</p>
      </div>
    </div>
  );
}

function Pagination({
  page, totalPages, onChange,
}: { page: number; totalPages: number; onChange: (p: number) => void }) {
  return (
    <div className="flex items-center justify-between px-5 py-3 border-t border-border">
      <span className="text-xs text-muted-foreground">Page {page} of {totalPages}</span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
          className="flex items-center gap-1 rounded border border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-40 transition-colors"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Prev
        </button>
        <button
          onClick={() => onChange(page + 1)}
          disabled={page >= totalPages}
          className="flex items-center gap-1 rounded border border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-40 transition-colors"
        >
          Next <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function StatCard({
  label, value, sub, change, changeUp, icon: Icon, accent
}: {
  label: string; value: string; sub?: string; change?: string;
  changeUp?: boolean; icon: React.ElementType; accent?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{label}</span>
        <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg", accent ?? "bg-brand/15")}>
          <Icon className={cn("h-4 w-4", accent ? "text-white" : "text-brand")} />
        </div>
      </div>
      <div>
        <p className="text-3xl font-bold font-mono text-foreground tracking-tight">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
      {change && (
        <div className={cn("flex items-center gap-1 text-xs font-semibold", changeUp ? "text-yes" : "text-no")}>
          {changeUp ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
          {change}
        </div>
      )}
    </div>
  );
}

function MiniChart({ data, color }: { data: { v: number }[]; color: string }) {
  return (
    <ResponsiveContainer width="100%" height={48}>
      <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`grad-${color}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.3} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="v" stroke={color} fill={`url(#grad-${color})`} strokeWidth={1.5} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function genSeries(base: number, len = 24, vol = 0.08) {
  const arr = [];
  let v = base;
  for (let i = 0; i < len; i++) {
    v = v * (1 + (Math.random() - 0.48) * vol);
    arr.push({ v: Math.max(0, v) });
  }
  return arr;
}

function VolumeBar({ data }: { data: { name: string; v: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={120}>
      <BarChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
        <XAxis dataKey="name" tick={{ fill: "oklch(0.55 0.01 240)", fontSize: 10 }} axisLine={false} tickLine={false} />
        <YAxis hide />
        <Tooltip
          contentStyle={{ background: "oklch(0.16 0.006 240)", border: "1px solid oklch(0.22 0.008 240)", borderRadius: 8, fontSize: 11 }}
          labelStyle={{ color: "oklch(0.95 0.005 240)" }}
          formatter={(v: number) => [formatVolume(v), "Volume"]}
        />
        <Bar dataKey="v" fill="oklch(0.6 0.2 250)" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Admin Orders section ───────────────────────────────────────────────────────

function AdminOrdersSection({
  orders, loading, page, totalPages, total, onPageChange,
}: {
  orders: AdminOrder[]; loading: boolean; page: number;
  totalPages: number; total: number; onPageChange: (p: number) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <ShoppingBag className="h-4 w-4 text-brand" />
        <h2 className="text-base font-bold text-foreground">All Orders</h2>
        {total > 0 && (
          <span className="rounded-full bg-brand/20 text-brand text-xs font-bold px-2 py-0.5">{total}</span>
        )}
      </div>

      {!loading && orders.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <SummaryCard icon={Hash}       label="Total Orders" value={String(total)}
            accent="text-brand"   bg="bg-brand/10" />
          <SummaryCard icon={DollarSign} label="Page Volume"
            value={fmtAmount(orders.reduce((s, o) => s + o.amount, 0))}
            accent="text-chart-4" bg="bg-chart-4/10" />
          <SummaryCard icon={CheckCheck} label="Settled"
            value={String(orders.filter((o) => o.status === "settled").length)}
            accent="text-yes"     bg="bg-yes/10" />
          <SummaryCard icon={Timer}      label="Pending"
            value={String(orders.filter((o) => o.status === "pending" || o.status === "submitted").length)}
            accent="text-chart-4" bg="bg-chart-4/10" />
        </div>
      )}

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-14">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-center gap-2">
            <ShoppingBag className="h-8 w-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No orders found</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/30">
                    <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">#</th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Merchant</th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Market</th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Outcome</th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Side</th>
                    <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Amount</th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {orders.map((order, idx) => {
                    const merchant = typeof order.merchantId === "object" ? order.merchantId : null;
                    return (
                      <tr key={order._id} className="hover:bg-secondary/20 transition-colors">
                        <td className="px-5 py-4 text-sm text-muted-foreground font-mono">{(page - 1) * 10 + idx + 1}</td>
                        <td className="px-5 py-4 text-sm text-foreground">
                          {merchant?.name ?? (typeof order.merchantId === "string" ? order.merchantId.slice(0, 8) + "…" : "—")}
                        </td>
                        <td className="px-5 py-4 max-w-[180px]">
                          <p className="truncate text-sm text-foreground font-medium">
                            {order.marketQuestion || order.conditionId.slice(0, 16) + "…"}
                          </p>
                        </td>
                        <td className="px-5 py-4">
                          <span className={cn(
                            "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
                            order.outcome === "Yes" ? "bg-yes/15 text-yes" : "bg-no/15 text-no"
                          )}>
                            {order.outcome}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-sm capitalize text-muted-foreground">{order.side}</td>
                        <td className="px-5 py-4 text-right text-sm font-semibold font-mono text-foreground">{fmtAmount(order.amount)}</td>
                        <td className="px-5 py-4">
                          <span className={cn(
                            "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold capitalize",
                            ORDER_STATUS_STYLE[order.status] ?? "bg-secondary text-muted-foreground"
                          )}>
                            {order.status}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-sm text-muted-foreground whitespace-nowrap">{fmtDate(order.createdAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalPages={totalPages} onChange={onPageChange} />
          </>
        )}
      </div>
    </div>
  );
}

// ── Admin Transactions section ─────────────────────────────────────────────────

function AdminTransactionsSection({
  txns, loading, page, totalPages, total, onPageChange,
}: {
  txns: AdminTransaction[]; loading: boolean; page: number;
  totalPages: number; total: number; onPageChange: (p: number) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <ArrowUpDown className="h-4 w-4 text-brand" />
        <h2 className="text-base font-bold text-foreground">All Transactions</h2>
        {total > 0 && (
          <span className="rounded-full bg-brand/20 text-brand text-xs font-bold px-2 py-0.5">{total}</span>
        )}
      </div>

      {!loading && txns.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <SummaryCard icon={Receipt}    label="Total Txns"  value={String(total)}
            accent="text-brand"   bg="bg-brand/10" />
          <SummaryCard icon={DollarSign} label="Page Volume"
            value={fmtAmount(txns.reduce((s, t) => s + t.amount, 0))}
            accent="text-chart-4" bg="bg-chart-4/10" />
          <SummaryCard icon={CheckCheck} label="Confirmed"
            value={String(txns.filter((t) => t.status === "confirmed").length)}
            accent="text-yes"     bg="bg-yes/10" />
          <SummaryCard icon={XCircle}    label="Failed"
            value={String(txns.filter((t) => t.status === "failed").length)}
            accent="text-no"      bg="bg-no/10" />
        </div>
      )}

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-14">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
          </div>
        ) : txns.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-center gap-2">
            <ArrowUpDown className="h-8 w-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No transactions found</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/30">
                    <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">#</th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Merchant</th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Type</th>
                    <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Amount</th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Description</th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {txns.map((tx, idx) => {
                    const merchant = typeof tx.merchantId === "object" ? tx.merchantId : null;
                    return (
                      <tr key={tx._id} className="hover:bg-secondary/20 transition-colors">
                        <td className="px-5 py-4 text-sm text-muted-foreground font-mono">{(page - 1) * 10 + idx + 1}</td>
                        <td className="px-5 py-4 text-sm text-foreground">
                          {merchant?.name ?? (typeof tx.merchantId === "string" ? tx.merchantId.slice(0, 8) + "…" : "—")}
                        </td>
                        <td className="px-5 py-4">
                          <span className="capitalize text-sm text-foreground font-medium">
                            {tx.type.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right text-sm font-semibold font-mono text-foreground">
                          {fmtAmount(tx.amount)}{" "}
                          <span className="text-xs text-muted-foreground">{tx.currency}</span>
                        </td>
                        <td className="px-5 py-4 text-sm text-muted-foreground max-w-[200px]">
                          <p className="truncate">{tx.description || "—"}</p>
                        </td>
                        <td className="px-5 py-4">
                          <span className={cn(
                            "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold capitalize",
                            TX_STATUS_STYLE[tx.status] ?? "bg-secondary text-muted-foreground"
                          )}>
                            {tx.status}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-sm text-muted-foreground whitespace-nowrap">{fmtDate(tx.createdAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalPages={totalPages} onChange={onPageChange} />
          </>
        )}
      </div>
    </div>
  );
}

// ── Main overview page ─────────────────────────────────────────────────────────

export default function AdminOverview() {
  const { token } = useAuth();
  const { isConnected, address: walletAddress, chainId } = useWalletContext();

  const [markets, setMarkets]         = useState<PolyMarket[]>([]);
  const [loading, setLoading]         = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  // Orders
  const [adminOrders, setAdminOrders]           = useState<AdminOrder[]>([]);
  const [ordersLoading, setOrdersLoading]       = useState(true);
  const [ordersPage, setOrdersPage]             = useState(1);
  const [ordersTotalPages, setOrdersTotalPages] = useState(1);
  const [ordersTotal, setOrdersTotal]           = useState(0);

  // Transactions
  const [adminTxns, setAdminTxns]               = useState<AdminTransaction[]>([]);
  const [txnsLoading, setTxnsLoading]           = useState(true);
  const [txnsPage, setTxnsPage]                 = useState(1);
  const [txnsTotalPages, setTxnsTotalPages]     = useState(1);
  const [txnsTotal, setTxnsTotal]               = useState(0);

  const loadMarkets = async () => {
    setLoading(true);
    const data = await clientFetchMarkets({ limit: 40, active: true, order: "volume", ascending: false });
    setMarkets(data);
    setLastRefresh(new Date());
    setLoading(false);
  };

  useEffect(() => { loadMarkets(); }, []);

  useEffect(() => {
    if (!token) return;
    setOrdersLoading(true);
    fetch(`${BACKEND}/api/admin/orders?page=${ordersPage}&limit=10`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        const list       = data.data ?? data.docs ?? [];
        const totalPages = data.meta?.totalPages ?? data.totalPages ?? 1;
        const total      = data.meta?.total ?? data.total ?? list.length;
        setAdminOrders(list);
        setOrdersTotalPages(totalPages);
        setOrdersTotal(total);
      })
      .catch(() => setAdminOrders([]))
      .finally(() => setOrdersLoading(false));
  }, [token, ordersPage]);

  useEffect(() => {
    if (!token) return;
    setTxnsLoading(true);
    fetch(`${BACKEND}/api/admin/transactions?page=${txnsPage}&limit=10`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        const list       = data.data ?? data.docs ?? [];
        const totalPages = data.meta?.totalPages ?? data.totalPages ?? 1;
        const total      = data.meta?.total ?? data.total ?? list.length;
        setAdminTxns(list);
        setTxnsTotalPages(totalPages);
        setTxnsTotal(total);
      })
      .catch(() => setAdminTxns([]))
      .finally(() => setTxnsLoading(false));
  }, [token, txnsPage]);

  const totalVolume    = markets.reduce((s, m) => s + (m.volumeNum ?? m.volume ?? 0), 0);
  const totalLiquidity = markets.reduce((s, m) => s + (m.liquidityNum ?? m.liquidity ?? 0), 0);
  const activeCount    = markets.filter((m) => m.active && !m.closed).length;
  const closedCount    = markets.filter((m) => m.closed).length;

  const weeklyVolData = [
    { name: "Mon", v: totalVolume * 0.11 },
    { name: "Tue", v: totalVolume * 0.14 },
    { name: "Wed", v: totalVolume * 0.13 },
    { name: "Thu", v: totalVolume * 0.18 },
    { name: "Fri", v: totalVolume * 0.16 },
    { name: "Sat", v: totalVolume * 0.12 },
    { name: "Sun", v: totalVolume * 0.16 },
  ];

  const topByVolume = markets.slice(0, 8);

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Overview</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {markets.length} markets loaded from database
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastRefresh && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              Refreshed {lastRefresh.toLocaleTimeString()}
            </div>
          )}
          <button
            onClick={loadMarkets}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Wallet status card ── */}
      <div className={cn(
        "rounded-xl border p-5 flex items-center gap-4",
        isConnected
          ? "border-yes/20 bg-yes/5"
          : "border-destructive/20 bg-destructive/5"
      )}>
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl shrink-0",
          isConnected ? "bg-yes/15" : "bg-destructive/15")}>
          {isConnected
            ? <CheckCircle2 className="h-5 w-5 text-yes" />
            : <AlertCircle  className="h-5 w-5 text-destructive" />
          }
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">
            Wallet {isConnected ? "Connected" : "Not Connected"}
          </p>
          {isConnected && walletAddress ? (
            <p className="text-xs font-mono text-muted-foreground mt-0.5 truncate">
              {walletAddress}
            </p>
          ) : (
            <p className="text-xs text-destructive mt-0.5">
              Connect your wallet to enable order execution
            </p>
          )}
        </div>
        {isConnected ? (
          <span className="text-[10px] font-semibold rounded-full px-2.5 py-1 bg-yes/15 text-yes">
            Orders active
          </span>
        ) : (
          <a
            href="/admin/wallet"
            className="text-[10px] font-semibold rounded-full px-2.5 py-1 bg-destructive/15 text-destructive hover:bg-destructive/25 transition-colors"
          >
            Connect wallet
          </a>
        )}
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Volume"   value={formatVolume(totalVolume)}   sub="All active markets" change="+12.4% vs last week" changeUp icon={TrendingUp} />
        <StatCard label="Liquidity"      value={formatVolume(totalLiquidity)} sub="Open interest"     change="+5.2% vs last week"  changeUp icon={Droplets} />
        <StatCard label="Active Markets" value={String(activeCount)} sub={`${closedCount} resolved`}  change="+3 new today"        changeUp icon={Activity} />
        <StatCard label="Traders"        value="—"                   sub="Requires auth"                                                    icon={Users} />
      </div>

      {/* ── Charts row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-semibold text-foreground">Weekly Volume Distribution</p>
              <p className="text-xs text-muted-foreground">Estimated from live market data</p>
            </div>
            <span className="text-xs font-mono text-brand font-bold">{formatVolume(totalVolume)}</span>
          </div>
          {loading ? (
            <div className="h-28 animate-pulse rounded-lg bg-secondary" />
          ) : (
            <VolumeBar data={weeklyVolData} />
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-sm font-semibold text-foreground mb-4">Market Status</p>
          <div className="space-y-3">
            {[
              { label: "Active",           count: activeCount,                              color: "bg-yes",     pct: markets.length ? (activeCount / markets.length) * 100 : 0 },
              { label: "Closed / Resolved",count: closedCount,                              color: "bg-no",      pct: markets.length ? (closedCount / markets.length) * 100 : 0 },
              { label: "Featured",         count: markets.filter((m) => m.featured).length, color: "bg-brand",   pct: markets.length ? (markets.filter((m) => m.featured).length / markets.length) * 100 : 0 },
              { label: "New",              count: markets.filter((m) => m.new).length,      color: "bg-chart-4", pct: markets.length ? (markets.filter((m) => m.new).length / markets.length) * 100 : 0 },
            ].map((row) => (
              <div key={row.label}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground">{row.label}</span>
                  <span className="font-mono font-semibold text-foreground">{row.count}</span>
                </div>
                <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                  <div className={cn("h-full rounded-full transition-all", row.color)} style={{ width: `${row.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Sparklines ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Volume Trend (24h)", color: "oklch(0.6 0.2 250)",  val: formatVolume(totalVolume * 0.04) },
          { label: "New Markets",        color: "oklch(0.65 0.18 145)", val: String(markets.filter((m) => m.new).length) },
          { label: "Avg Liquidity",      color: "oklch(0.75 0.15 60)",  val: markets.length ? formatVolume(totalLiquidity / markets.length) : "$0" },
          { label: "Featured Markets",   color: "oklch(0.7 0.18 300)",  val: String(markets.filter((m) => m.featured).length) },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-4">
            <div className="flex justify-between items-center mb-2">
              <p className="text-xs text-muted-foreground font-medium">{s.label}</p>
              <p className="text-sm font-bold font-mono text-foreground">{s.val}</p>
            </div>
            <MiniChart data={genSeries(50)} color={s.color} />
          </div>
        ))}
      </div>

      {/* ── Top markets table ── */}
      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <p className="text-sm font-semibold text-foreground">Top Markets by Volume</p>
          <a href="/admin/markets" className="text-xs text-brand hover:underline">View all</a>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                {["Market", "Volume", "Liquidity", "Yes %", "Status"].map((h) => (
                  <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {loading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 5 }).map((_, j) => (
                        <td key={j} className="px-5 py-4"><div className="h-4 rounded bg-secondary animate-pulse" /></td>
                      ))}
                    </tr>
                  ))
                : topByVolume.map((m) => {
                    let yesPct = 50;
                    try { yesPct = Math.round(parseFloat(JSON.parse(m.outcomePrices ?? '["0.5"]')[0]) * 100); } catch {}
                    return (
                      <tr key={m.id} className="hover:bg-secondary/20 transition-colors">
                        <td className="px-5 py-4 max-w-xs">
                          <p className="font-medium text-foreground truncate text-sm">{m.question}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{m.slug}</p>
                        </td>
                        <td className="px-5 py-4 font-mono text-sm text-foreground">{formatVolume(m.volumeNum ?? m.volume)}</td>
                        <td className="px-5 py-4 font-mono text-sm text-foreground">{formatVolume(m.liquidityNum ?? m.liquidity)}</td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 rounded-full bg-secondary overflow-hidden">
                              <div className="h-full bg-yes rounded-full" style={{ width: `${yesPct}%` }} />
                            </div>
                            <span className="text-xs font-mono text-yes">{yesPct}%</span>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span className={cn(
                            "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
                            m.active && !m.closed ? "bg-yes/15 text-yes" : "bg-secondary text-muted-foreground"
                          )}>
                            {m.active && !m.closed ? "Active" : "Closed"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
