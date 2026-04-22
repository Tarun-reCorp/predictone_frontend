"use client";

import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import {
  Users, Activity, RefreshCw, Clock,
  ShoppingBag, ArrowUpDown, ChevronLeft, ChevronRight,
  Hash, DollarSign, CheckCheck, Timer, Receipt, XCircle,
  CheckCircle2, AlertCircle, TrendingUp, Wallet, FileCheck,
  BarChart2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import { useWalletContext } from "@/contexts/wallet-context";

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

// ── Types ──────────────────────────────────────────────────────────────────────

interface DashboardData {
  merchants:   { total: number; active: number; blocked: number };
  orders:      { total: number; pending: number };
  volume:      { total: number };
  markets:     { total: number; active: number; resolved: number; cancelled: number };
  fundRequests:{ total: number; approved: number; pending: number; rejected: number; today: number };
  pendingFundRequests: number;
  topMerchants: { _id: string; name?: string; email?: string; totalVolume: number; orderCount: number }[];
}

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
function fmtVolume(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

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
  label, value, sub, icon: Icon, accent, iconBg,
}: {
  label: string; value: string; sub?: string;
  icon: React.ElementType; accent?: string; iconBg?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{label}</span>
        <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg", iconBg ?? "bg-brand/15")}>
          <Icon className={cn("h-4 w-4", accent ?? "text-brand")} />
        </div>
      </div>
      <div>
        <p className="text-3xl font-bold font-mono text-foreground tracking-tight">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
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
  const { isConnected, address: walletAddress } = useWalletContext();

  const [dashboard, setDashboard]         = useState<DashboardData | null>(null);
  const [dashLoading, setDashLoading]     = useState(true);
  const [lastRefresh, setLastRefresh]     = useState<Date | null>(null);

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

  const loadDashboard = async () => {
    if (!token) return;
    setDashLoading(true);
    try {
      const res = await fetch(`${BACKEND}/api/admin/dashboard`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setDashboard(data.data ?? data);
      setLastRefresh(new Date());
    } catch {
      // keep previous data
    } finally {
      setDashLoading(false);
    }
  };

  useEffect(() => { loadDashboard(); }, [token]);

  useEffect(() => {
    if (!token) return;
    setOrdersLoading(true);
    fetch(`${BACKEND}/api/admin/orders?page=${ordersPage}&limit=10`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        setAdminOrders(data.data ?? data.docs ?? []);
        setOrdersTotalPages(data.meta?.totalPages ?? data.totalPages ?? 1);
        setOrdersTotal(data.meta?.total ?? data.total ?? 0);
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
        setAdminTxns(data.data ?? data.docs ?? []);
        setTxnsTotalPages(data.meta?.totalPages ?? data.totalPages ?? 1);
        setTxnsTotal(data.meta?.total ?? data.total ?? 0);
      })
      .catch(() => setAdminTxns([]))
      .finally(() => setTxnsLoading(false));
  }, [token, txnsPage]);

  const d = dashboard;

  // Bar chart data for market status
  const marketBarData = d ? [
    { name: "Active",    v: d.markets.active },
    { name: "Resolved",  v: d.markets.resolved },
    { name: "Cancelled", v: d.markets.cancelled },
  ] : [];

  // Bar chart data for fund requests
  const frBarData = d ? [
    { name: "Approved", v: d.fundRequests.approved },
    { name: "Pending",  v: d.fundRequests.pending },
    { name: "Rejected", v: d.fundRequests.rejected },
  ] : [];

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Overview</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Platform statistics and activity
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
            onClick={loadDashboard}
            disabled={dashLoading}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", dashLoading && "animate-spin")} />
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
      {dashLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-5 h-28 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard label="Total Merchants"  value={String(d?.merchants.total ?? 0)}
            sub={`${d?.merchants.blocked ?? 0} blocked`}
            icon={Users}      accent="text-brand"    iconBg="bg-brand/15" />
          <StatCard label="Active Merchants" value={String(d?.merchants.active ?? 0)}
            sub="Currently active"
            icon={Activity}   accent="text-yes"      iconBg="bg-yes/15" />
          <StatCard label="Total Orders"     value={String(d?.orders.total ?? 0)}
            sub={`${d?.orders.pending ?? 0} pending`}
            icon={ShoppingBag} accent="text-chart-4" iconBg="bg-chart-4/15" />
          <StatCard label="Total Volume"     value={fmtVolume(d?.volume.total ?? 0)}
            sub="All-time order volume"
            icon={TrendingUp}  accent="text-brand"   iconBg="bg-brand/15" />
          <StatCard label="Total Markets"    value={String(d?.markets.total ?? 0)}
            sub={`${d?.markets.active ?? 0} active`}
            icon={BarChart2}   accent="text-chart-4" iconBg="bg-chart-4/15" />
          <StatCard label="Pending Fund Reqs" value={String(d?.fundRequests.pending ?? 0)}
            sub={`${d?.fundRequests.today ?? 0} submitted today`}
            icon={Wallet}      accent="text-no"      iconBg="bg-no/15" />
        </div>
      )}

      {/* ── Market Status + Fund Request charts ── */}
      {!dashLoading && d && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Market Status */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm font-semibold text-foreground">Market Status</p>
                <p className="text-xs text-muted-foreground">{d.markets.total} total markets in DB</p>
              </div>
              <a href="/admin/markets" className="text-xs text-brand hover:underline">View all</a>
            </div>
            <div className="space-y-3 mb-4">
              {[
                { label: "Active",    count: d.markets.active,    color: "bg-yes",     pct: d.markets.total ? (d.markets.active / d.markets.total) * 100 : 0 },
                { label: "Resolved",  count: d.markets.resolved,  color: "bg-brand",   pct: d.markets.total ? (d.markets.resolved / d.markets.total) * 100 : 0 },
                { label: "Cancelled", count: d.markets.cancelled, color: "bg-no",      pct: d.markets.total ? (d.markets.cancelled / d.markets.total) * 100 : 0 },
              ].map((row) => (
                <div key={row.label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">{row.label}</span>
                    <span className="font-mono font-semibold text-foreground">{row.count}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                    <div className={cn("h-full rounded-full transition-all", row.color)} style={{ width: `${Math.min(row.pct, 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <ResponsiveContainer width="100%" height={90}>
              <BarChart data={marketBarData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fill: "oklch(0.55 0.01 240)", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip
                  contentStyle={{ background: "oklch(0.16 0.006 240)", border: "1px solid oklch(0.22 0.008 240)", borderRadius: 8, fontSize: 11 }}
                  formatter={(v: number) => [v, "Markets"]}
                />
                <Bar dataKey="v" fill="oklch(0.6 0.2 250)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Fund Requests Summary */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm font-semibold text-foreground">Fund Requests</p>
                <p className="text-xs text-muted-foreground">{d.fundRequests.total} total requests</p>
              </div>
              <a href="/admin/fund-requests" className="text-xs text-brand hover:underline">View all</a>
            </div>
            <div className="space-y-3 mb-4">
              {[
                { label: "Approved", count: d.fundRequests.approved, color: "bg-yes",     pct: d.fundRequests.total ? (d.fundRequests.approved / d.fundRequests.total) * 100 : 0 },
                { label: "Pending",  count: d.fundRequests.pending,  color: "bg-chart-4", pct: d.fundRequests.total ? (d.fundRequests.pending / d.fundRequests.total) * 100 : 0 },
                { label: "Rejected", count: d.fundRequests.rejected, color: "bg-no",      pct: d.fundRequests.total ? (d.fundRequests.rejected / d.fundRequests.total) * 100 : 0 },
              ].map((row) => (
                <div key={row.label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">{row.label}</span>
                    <span className="font-mono font-semibold text-foreground">{row.count}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                    <div className={cn("h-full rounded-full transition-all", row.color)} style={{ width: `${Math.min(row.pct, 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <ResponsiveContainer width="100%" height={90}>
              <BarChart data={frBarData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fill: "oklch(0.55 0.01 240)", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip
                  contentStyle={{ background: "oklch(0.16 0.006 240)", border: "1px solid oklch(0.22 0.008 240)", borderRadius: 8, fontSize: 11 }}
                  formatter={(v: number) => [v, "Requests"]}
                />
                <Bar dataKey="v" fill="oklch(0.6 0.2 250)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── Top Merchants by Volume ── */}
      {!dashLoading && d && d.topMerchants.length > 0 && (
        <div className="rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div className="flex items-center gap-2">
              <FileCheck className="h-4 w-4 text-brand" />
              <p className="text-sm font-semibold text-foreground">Top Merchants by Volume</p>
            </div>
            <a href="/admin/merchants" className="text-xs text-brand hover:underline">View all</a>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/30">
                  {["#", "Merchant", "Total Volume", "Orders"].map((h) => (
                    <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {d.topMerchants.map((m, idx) => (
                  <tr key={m._id} className="hover:bg-secondary/20 transition-colors">
                    <td className="px-5 py-4 text-sm text-muted-foreground font-mono">{idx + 1}</td>
                    <td className="px-5 py-4">
                      <p className="text-sm font-medium text-foreground">{m.name ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">{m.email ?? m._id}</p>
                    </td>
                    <td className="px-5 py-4 font-mono text-sm text-foreground font-semibold">
                      {fmtVolume(m.totalVolume)}
                    </td>
                    <td className="px-5 py-4 text-sm text-muted-foreground">
                      {m.orderCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Orders table ── */}
      <AdminOrdersSection
        orders={adminOrders}
        loading={ordersLoading}
        page={ordersPage}
        totalPages={ordersTotalPages}
        total={ordersTotal}
        onPageChange={setOrdersPage}
      />

      {/* ── Transactions table ── */}
      <AdminTransactionsSection
        txns={adminTxns}
        loading={txnsLoading}
        page={txnsPage}
        totalPages={txnsTotalPages}
        total={txnsTotal}
        onPageChange={setTxnsPage}
      />
    </div>
  );
}
