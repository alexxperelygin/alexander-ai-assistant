// Карта нервной системы: путь данных от обнаружения токена до закрытия сделки.
//
// Главное правило этого файла: КАЖДОЕ свечение подкреплено числом. Узел светится
// не потому что красиво, а потому что через него сейчас идёт поток; замерший
// узел не дышит и не мигает. Иначе панель выглядела бы живой ровно в тот момент,
// когда система встала, — а это худшее, что дашборд может сделать.
//
// Порядок узлов повторяет реальный конвейер из src/lib/ingestion/scanner.ts и
// src/lib/monitor/positions.ts, а не придуман для картинки.

export type NodeState = "live" | "think" | "good" | "warn" | "bad" | "idle";

export interface OrganNode {
  /** Короткое имя органа — то, что читает человек. */
  title: string;
  /** Что это на самом деле, техническим языком. */
  subtitle: string;
  /** Главное число узла. null = нет данных, и так и печатается. */
  value: string | null;
  state: NodeState;
}

const COLOR: Record<NodeState, string> = {
  live: "#22d3ee",
  think: "#a78bfa",
  good: "#4ade80",
  warn: "#fbbf24",
  bad: "#fb7185",
  idle: "#64748b",
};

/** Позиции узлов на дуге: организм, а не блок-схема. */
const POS: { x: number; y: number }[] = [
  { x: 92, y: 176 },
  { x: 246, y: 96 },
  { x: 400, y: 178 },
  { x: 554, y: 96 },
  { x: 708, y: 178 },
  { x: 862, y: 104 },
];

/** Дуга между двумя узлами: изгиб вверх/вниз по направлению перепада. */
function synapsePath(a: { x: number; y: number }, b: { x: number; y: number }): string {
  const mx = (a.x + b.x) / 2;
  return `M ${a.x} ${a.y} C ${mx} ${a.y}, ${mx} ${b.y}, ${b.x} ${b.y}`;
}

/** Короткие дендриты вокруг ядра — их длина одинакова, они не кодируют данные. */
function dendrites(x: number, y: number, seed: number) {
  const out: { x1: number; y1: number; x2: number; y2: number }[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI * 2 * i) / 6 + seed * 0.7;
    out.push({
      x1: x + Math.cos(a) * 17,
      y1: y + Math.sin(a) * 17,
      x2: x + Math.cos(a) * 27,
      y2: y + Math.sin(a) * 27,
    });
  }
  return out;
}

export function Organism({ nodes }: { nodes: OrganNode[] }) {
  const n = nodes.slice(0, POS.length);

  return (
    <div className="card overflow-x-auto">
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold" style={{ color: "var(--txt)" }}>
          Нервная система
        </h2>
        <span className="stat-label">путь данных: от обнаружения до выхода из сделки</span>
      </div>

      <svg viewBox="0 44 954 320" className="w-full" style={{ minWidth: 720 }} role="img"
           aria-label="Схема конвейера обработки: узлы и связи между ними">
        <defs>
          <radialGradient id="halo">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.55" />
            <stop offset="70%" stopColor="currentColor" stopOpacity="0.1" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Связи рисуются первыми, чтобы уходить под ядра. Поток «течёт» только
            если оба конца живы: связь между мёртвыми узлами не анимируется. */}
        {n.slice(0, -1).map((node, i) => {
          const next = n[i + 1] as OrganNode;
          const a = POS[i] as { x: number; y: number };
          const b = POS[i + 1] as { x: number; y: number };
          const flowing = node.state !== "idle" && next.state !== "idle";
          return (
            <path
              key={`s${i}`}
              d={synapsePath(a, b)}
              className={flowing ? "synapse" : "synapse synapse-still"}
              stroke={COLOR[node.state]}
              strokeOpacity={flowing ? 0.5 : 0.16}
              strokeWidth={2}
              strokeDasharray="7 10"
              style={{ animationDelay: `${i * 0.32}s` }}
            />
          );
        })}

        {/* Обратная связь: результаты сделок возвращаются в исследование и
            меняют пороги. Это реальная петля проекта, а не украшение. */}
        {/* Петля проходит НИЖЕ всех подписей узлов. Первая версия шла между
            ними и перечёркивала строки «разобрано за 24ч» и «открытых из 40
            слотов» — схема связей, которая портит чтение чисел, хуже, чем
            отсутствие схемы. */}
        <path
          d="M 862 200 C 862 330, 92 330, 92 272"
          fill="none"
          stroke={COLOR.think}
          strokeOpacity={0.26}
          strokeWidth={1.5}
          strokeDasharray="3 9"
        />
        <path d="M 92 272 l 6 9 M 92 272 l -6 9" fill="none" stroke={COLOR.think}
              strokeOpacity={0.5} strokeWidth={1.5} strokeLinecap="round" />
        <text x="477" y="352" textAnchor="middle" fontSize="10" fill="var(--txt-faint)"
              letterSpacing="1.4">
          ОБРАТНАЯ СВЯЗЬ · исход сделок → пороги отбора
        </text>

        {n.map((node, i) => {
          const p = POS[i] as { x: number; y: number };
          const c = COLOR[node.state];
          const still = node.state === "idle";
          return (
            <g key={node.title} color={c} className={still ? "node-still" : undefined}>
              {dendrites(p.x, p.y, i).map((d, k) => (
                <line key={k} x1={d.x1} y1={d.y1} x2={d.x2} y2={d.y2}
                      stroke={c} strokeOpacity={still ? 0.16 : 0.4} strokeWidth={1.2}
                      strokeLinecap="round" />
              ))}

              <circle cx={p.x} cy={p.y} r={40} fill="url(#halo)" className="node-halo"
                      style={{ animationDelay: `${i * 0.4}s` }} />
              <circle cx={p.x} cy={p.y} r={17} fill="rgba(4,7,14,0.9)" stroke={c}
                      strokeOpacity={0.85} strokeWidth={1.6} className="node-core"
                      style={{ animationDelay: `${i * 0.4}s` }} />
              <circle cx={p.x} cy={p.y} r={5.5} fill={c} fillOpacity={still ? 0.35 : 0.95} />

              <text x={p.x} y={p.y + 50} textAnchor="middle" fontSize="12.5" fontWeight="600"
                    fill="var(--txt)">
                {node.title}
              </text>
              <text x={p.x} y={p.y + 66} textAnchor="middle" fontSize="13.5" fontWeight="700"
                    fill={c} style={{ fontVariantNumeric: "tabular-nums" }}>
                {node.value ?? "нет данных"}
              </text>
              <text x={p.x} y={p.y + 80} textAnchor="middle" fontSize="9.5"
                    fill="var(--txt-faint)">
                {node.subtitle}
              </text>
            </g>
          );
        })}
      </svg>

      <p className="mt-1 text-[11px]" style={{ color: "var(--txt-dim)" }}>
        Узел светится, только когда через него реально идёт поток. Погасший и неподвижный
        узел означает остановку на этом участке, а не оформление.
      </p>
    </div>
  );
}
