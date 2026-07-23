import type { ReactNode } from "react";

export function fmtUsd(v: number | null | undefined, digits = 0): string {
  if (v == null || !Number.isFinite(v)) return "—";
  if (Math.abs(v) < 0.01 && v !== 0) return `$${v.toExponential(2)}`;
  return `$${v.toLocaleString("en-US", { maximumFractionDigits: digits })}`;
}

export function fmtPrice(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return v < 0.001 ? `$${v.toExponential(3)}` : `$${v.toFixed(6)}`;
}

export function fmtPct(v: number | null | undefined, digits = 1): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const s = v >= 0 ? "+" : "";
  return `${s}${v.toFixed(digits)}%`;
}

export function timeAgo(d: Date | null | undefined): string {
  if (!d) return "—";
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return `${s}с`;
  if (s < 3600) return `${Math.floor(s / 60)}м`;
  if (s < 86400) return `${Math.floor(s / 3600)}ч`;
  return `${Math.floor(s / 86400)}д`;
}

const STATUS_COLORS: Record<string, string> = {
  WATCH: "bg-zinc-700/60 text-zinc-300",
  CANDIDATE: "bg-sky-900/60 text-sky-300",
  READY: "bg-emerald-900/60 text-emerald-300",
  BUY: "bg-emerald-800/80 text-emerald-200",
  HOLD: "bg-amber-900/60 text-amber-300",
  TAKE_PROFIT: "bg-lime-900/60 text-lime-300",
  EXIT: "bg-orange-900/60 text-orange-300",
  INVALIDATED: "bg-zinc-800 text-zinc-500",
  AVOID: "bg-red-900/60 text-red-300",
  DATA_UNAVAILABLE: "bg-purple-900/50 text-purple-300",
  OPEN: "bg-emerald-900/60 text-emerald-300",
  PARTIAL_EXIT: "bg-lime-900/60 text-lime-300",
  CLOSED: "bg-zinc-700/60 text-zinc-300",
  STOPPED: "bg-red-900/60 text-red-300",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${STATUS_COLORS[status] ?? "bg-zinc-700 text-zinc-300"}`}
    >
      {status.replace("_", " ")}
    </span>
  );
}

export function DataModeBadge({ mode }: { mode: string }) {
  return mode === "mock" ? (
    <span className="inline-block rounded bg-fuchsia-900/70 px-1.5 py-0.5 text-xs font-bold text-fuchsia-200">
      MOCK DATA
    </span>
  ) : (
    <span className="inline-block rounded bg-emerald-950 px-1.5 py-0.5 text-xs text-emerald-400">
      live
    </span>
  );
}

export function ScoreBar({ value, danger = false }: { value: number; danger?: boolean }) {
  const color = danger
    ? value > 60 ? "bg-red-500" : value > 30 ? "bg-amber-500" : "bg-emerald-500"
    : value >= 65 ? "bg-emerald-500" : value >= 50 ? "bg-sky-500" : "bg-zinc-500";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded bg-zinc-800">
        <div className={`h-full ${color}`} style={{ width: `${Math.min(100, value)}%` }} />
      </div>
      <span className="text-xs tabular-nums">{value.toFixed(0)}</span>
    </div>
  );
}

export function Card({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <div className="card">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-300">{title}</h2>
        {right}
      </div>
      {children}
    </div>
  );
}

export function Empty({ text }: { text: string }) {
  return <p className="py-6 text-center text-sm text-zinc-600">{text}</p>;
}
