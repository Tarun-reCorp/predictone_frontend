/**
 * Shared Tailwind class presets for tables so every page renders
 * with the same padding, font sizes, and row rhythm.
 */

export const TABLE = {
  wrapper:  "rounded-xl border border-border bg-card overflow-hidden",
  scroll:   "overflow-x-auto",
  table:    "w-full text-sm",
  thead:    "border-b border-border bg-secondary/30",
  th:       "px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground",
  thRight:  "px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground",
  tbody:    "divide-y divide-border/60",
  row:      "hover:bg-secondary/20 transition-colors",
  td:       "px-4 py-3 text-sm text-foreground align-middle",
  tdMuted:  "px-4 py-3 text-sm text-muted-foreground align-middle",
  tdMono:   "px-4 py-3 text-sm font-mono text-foreground align-middle",
  tdRight:  "px-4 py-3 text-sm text-foreground align-middle text-right",
  footer:   "flex items-center justify-between px-4 py-3 border-t border-border bg-secondary/10 text-xs",
} as const;
