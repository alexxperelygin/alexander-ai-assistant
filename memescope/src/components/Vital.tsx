import type { ReactNode } from "react";
import type { NodeState } from "./Organism";

// Показатель жизнедеятельности: одно число крупно, под ним — расшифровка
// человеческим языком, и при наличии нормы — полоса «сколько от нормы».
//
// `value` принимает null отдельно от нуля намеренно. Ноль снапшотов и
// «не смогли посчитать» — разные события: первое означает, что система стоит,
// второе — что мы этого не знаем. Показать «0» вместо «нет данных» значило бы
// придумать измерение.

const TONE: Record<NodeState, string> = {
  live: "glow-live",
  think: "glow-think",
  good: "glow-good",
  warn: "glow-warn",
  bad: "glow-bad",
  idle: "glow-idle",
};

const BORDER: Partial<Record<NodeState, string>> = {
  live: "card-live",
  good: "card-good",
  warn: "card-warn",
  bad: "card-bad",
};

export function Vital({
  label,
  value,
  unit,
  note,
  state,
  fill,
}: {
  /** Имя показателя на языке организма: «Пульс», «Метаболизм». */
  label: string;
  /** Готовая строка значения или null — тогда печатается «нет данных». */
  value: string | null;
  unit?: string;
  /** Расшифровка: что это за число на самом деле. */
  note?: ReactNode;
  state: NodeState;
  /** Доля от нормы 0..1 для полосы. Опускается, если нормы не существует. */
  fill?: number;
}) {
  const tone = TONE[state];
  return (
    <div className={`card ${BORDER[state] ?? ""}`}>
      <div className="stat-label">{label}</div>
      <div className={`vital-value ${value == null ? "glow-idle" : tone}`}>
        {value ?? "нет данных"}
        {value != null && unit ? (
          <span className="ml-1 text-xs font-normal" style={{ color: "var(--txt-dim)" }}>
            {unit}
          </span>
        ) : null}
      </div>
      {fill != null && (
        <div className={`pulsebar mt-2 ${tone}`}>
          <i style={{ width: `${Math.max(2, Math.min(100, fill * 100))}%` }} />
        </div>
      )}
      {note && <div className="vital-note mt-1.5">{note}</div>}
    </div>
  );
}
