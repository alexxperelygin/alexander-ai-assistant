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

// Статус светится своим цветом: в тёмной камере заливка читается хуже, чем
// контур со свечением, а по цвету состояние узнаётся раньше, чем по тексту.
const STATUS_TONE: Record<string, string> = {
  WATCH: "#64748b",
  CANDIDATE: "#22d3ee",
  READY: "#4ade80",
  BUY: "#4ade80",
  HOLD: "#fbbf24",
  TAKE_PROFIT: "#a3e635",
  EXIT: "#fb923c",
  INVALIDATED: "#475569",
  AVOID: "#fb7185",
  DATA_UNAVAILABLE: "#a78bfa",
  OPEN: "#4ade80",
  PARTIAL_EXIT: "#a3e635",
  CLOSED: "#64748b",
  STOPPED: "#fb7185",
};

/** Русские подписи статусов: панель читает человек, а не машина. */
const STATUS_RU: Record<string, string> = {
  WATCH: "наблюдение",
  CANDIDATE: "кандидат",
  READY: "готов",
  BUY: "покупка",
  HOLD: "держим",
  TAKE_PROFIT: "фиксация",
  EXIT: "выход",
  INVALIDATED: "отменён",
  AVOID: "отбраковано",
  DATA_UNAVAILABLE: "нет данных",
  OPEN: "открыта",
  PARTIAL_EXIT: "частично",
  CLOSED: "закрыта",
  STOPPED: "по стопу",
};

export function StatusBadge({ status }: { status: string }) {
  const c = STATUS_TONE[status] ?? "#64748b";
  return (
    <span
      className="inline-block rounded-md px-1.5 py-0.5 text-[11px] font-medium"
      style={{
        color: c,
        border: `1px solid ${c}59`,
        background: `${c}14`,
        boxShadow: `0 0 12px -6px ${c}`,
      }}
      title={status}
    >
      {STATUS_RU[status] ?? status.replace("_", " ")}
    </span>
  );
}

export function DataModeBadge({ mode, compact = false }: { mode: string; compact?: boolean }) {
  // Режим mock подсвечен резко и намеренно, и в компактном виде тоже: спутать
  // выдуманные данные с живыми — самая дорогая ошибка этой панели. А вот
  // «живые данные» в каждой строке таблицы — шум: сто одинаковых зелёных
  // плашек ничего не сообщают и мешают читать числа. В таблицах живой режим
  // сжимается до точки с подсказкой.
  if (mode === "mock")
    return (
      <span
        className="inline-block rounded-md px-2 py-0.5 text-xs font-bold"
        style={{ color: "#f0abfc", border: "1px solid #e879f9", background: "rgba(232,121,249,0.14)", boxShadow: "0 0 16px -4px #e879f9" }}
        title="Данные сгенерированы, а не получены с рынка"
      >
        {compact ? "ВЫДУМАНО" : "ВЫДУМАННЫЕ ДАННЫЕ"}
      </span>
    );
  if (compact)
    return (
      <span
        className="inline-block h-1.5 w-1.5 rounded-full align-middle"
        style={{ background: "#4ade80", boxShadow: "0 0 8px #4ade80" }}
        title="живые данные с рынка"
      />
    );
  return (
    <span
      className="inline-block rounded-md px-2 py-0.5 text-xs"
      style={{ color: "#4ade80", border: "1px solid rgba(74,222,128,0.45)", background: "rgba(74,222,128,0.08)" }}
    >
      живые данные
    </span>
  );
}

export function ScoreBar({ value, danger = false }: { value: number; danger?: boolean }) {
  const color = danger
    ? value > 60 ? "#fb7185" : value > 30 ? "#fbbf24" : "#4ade80"
    : value >= 65 ? "#4ade80" : value >= 50 ? "#22d3ee" : "#64748b";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full" style={{ background: "rgba(120,160,220,0.12)" }}>
        <div
          className="h-full rounded-full"
          style={{ width: `${Math.min(100, value)}%`, background: color, boxShadow: `0 0 10px ${color}` }}
        />
      </div>
      <span className="text-xs tabular-nums" style={{ color }}>{value.toFixed(0)}</span>
    </div>
  );
}

export function Card({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <div className="card">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold" style={{ color: "var(--txt)" }}>{title}</h2>
        {right}
      </div>
      {children}
    </div>
  );
}

export function Empty({ text }: { text: string }) {
  return <p className="py-6 text-center text-sm" style={{ color: "var(--txt-faint)" }}>{text}</p>;
}
