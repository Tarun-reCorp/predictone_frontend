import Link from "next/link";
import { ArrowLeft, TrendingUp } from "lucide-react";

export default function MarketNotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-2xl bg-secondary border border-border">
          <TrendingUp className="h-8 w-8 text-muted-foreground" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">Market Not Found</h1>
        <p className="text-muted-foreground text-sm max-w-xs">
          This market may have been resolved, archived, or the ID is incorrect.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-brand/90 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Browse Markets
        </Link>
      </div>
    </div>
  );
}
