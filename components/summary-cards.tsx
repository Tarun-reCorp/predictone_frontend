import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SummaryCardItem {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone?: "default" | "yes" | "no" | "warn" | "brand";
  hint?: string;
}

const TONE: Record<NonNullable<SummaryCardItem["tone"]>, string> = {
  default: "text-foreground",
  yes:     "text-yes",
  no:      "text-no",
  warn:    "text-chart-4",
  brand:   "text-brand",
};

export function SummaryCards({ items }: { items: SummaryCardItem[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {items.map((it) => (
        <div key={it.label} className="rounded-xl border border-border bg-card p-4 flex flex-col gap-1.5">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
            <it.icon className="h-3.5 w-3.5" />
            {it.label}
          </div>
          <p className={cn("text-2xl font-bold font-mono leading-tight", TONE[it.tone ?? "default"])}>{it.value}</p>
          {it.hint && <p className="text-xs text-muted-foreground">{it.hint}</p>}
        </div>
      ))}
    </div>
  );
}
