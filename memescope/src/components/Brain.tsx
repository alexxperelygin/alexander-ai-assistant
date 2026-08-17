// Панель как нейросеть: узлы-нейроны, синапсы между ними и импульсы, бегущие
// по связям от входа к действию.
//
// Это не оформление поверх данных, а сама компоновка панели. Каждый нейрон —
// реальный показатель с запросом за ним, каждая связь — реальный путь данных
// в коде: обнаружение → наблюдение → оценка → отбор → позиция → исход, плюс
// обратная связь «исход сделок меняет пороги отбора».
//
// Правило прежнее и главное: свечение подкреплено числом. Погасший нейрон не
// пульсирует, по мёртвой связи импульсы не бегут. Панель, которая выглядит
// живой при остановленной системе, врёт опаснее, чем пустая.

export type NodeState = "live" | "think" | "good" | "warn" | "bad" | "idle";

export interface BrainNode {
  id: string;
  label: string;
  /** Главное число. null = нет данных, так и печатается. */
  value: string | null;
  /** Расшифровка мелким шрифтом: что это за число. */
  hint?: string;
  state: NodeState;
  x: number;
  y: number;
  /** Крупный узел — ключевой показатель, мелкий — вспомогательный. */
  big?: boolean;
}

export interface BrainEdge {
  from: string;
  to: string;
  /** Изгиб дуги: положительный — вверх, отрицательный — вниз. */
  bend?: number;
  /** Обратная связь рисуется тоньше и другим цветом. */
  feedback?: boolean;
}

const COLOR: Record<NodeState, string> = {
  live: "#22d3ee",
  think: "#a78bfa",
  good: "#4ade80",
  warn: "#fbbf24",
  bad: "#fb7185",
  idle: "#5a6b84",
};

const W = 1200;
const H = 596; // подобрано под самую нижнюю подпись: лишняя пустота съедала экран

/** Детерминированный генератор: фон обязан быть одинаковым при каждом рендере. */
function mulberry(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Фоновая нервная ткань: мелкие нейроны и связи между близкими соседями. */
const MESH = (() => {
  const rnd = mulberry(20260817);
  const pts: { x: number; y: number; r: number }[] = [];
  for (let i = 0; i < 54; i++) {
    pts.push({ x: rnd() * W, y: rnd() * H, r: 0.9 + rnd() * 1.9 });
  }
  const links: { a: number; b: number }[] = [];
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      const p = pts[i] as { x: number; y: number };
      const q = pts[j] as { x: number; y: number };
      const d = Math.hypot(p.x - q.x, p.y - q.y);
      if (d < 132) links.push({ a: i, b: j });
    }
  }
  return { pts, links };
})();

function arc(a: BrainNode, b: BrainNode, bend = 0): string {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2 - bend;
  return `M ${a.x} ${a.y} Q ${mx} ${my} ${b.x} ${b.y}`;
}

/** Дендриты вокруг сомы: длина не кодирует данные, это форма нейрона. */
function dendrites(n: BrainNode, r: number) {
  const rnd = mulberry(n.id.length * 977 + Math.round(n.x));
  const out: string[] = [];
  const count = n.big ? 9 : 6;
  for (let i = 0; i < count; i++) {
    const a = (Math.PI * 2 * i) / count + rnd() * 0.5;
    const len = r * (1.5 + rnd() * 1.1);
    const bendA = a + (rnd() - 0.5) * 0.9;
    out.push(
      `M ${n.x + Math.cos(a) * r} ${n.y + Math.sin(a) * r} ` +
      `Q ${n.x + Math.cos(bendA) * len * 0.7} ${n.y + Math.sin(bendA) * len * 0.7} ` +
      `${n.x + Math.cos(bendA) * len} ${n.y + Math.sin(bendA) * len}`,
    );
  }
  return out;
}

export function Brain({
  nodes,
  edges,
  clusters,
}: {
  nodes: BrainNode[];
  edges: BrainEdge[];
  /** Подписи областей: помогают читать карту, а не просто любоваться. */
  clusters: { title: string; x: number; y: number; rx: number; ry: number; tone: NodeState }[];
}) {
  const byId = new Map(nodes.map((n) => [n.id, n]));

  return (
    <div className="card overflow-x-auto p-3">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 860 }} role="img"
           aria-label="Схема системы: узлы показателей и связи между ними">
        <defs>
          <radialGradient id="soma">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.62" />
            <stop offset="55%" stopColor="currentColor" stopOpacity="0.13" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="lobe">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.2" />
            <stop offset="62%" stopColor="currentColor" stopOpacity="0.07" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </radialGradient>
          {edges.map((e, i) => {
            const a = byId.get(e.from);
            const b = byId.get(e.to);
            if (!a || !b) return null;
            return <path key={`p${i}`} id={`edge-${i}`} d={arc(a, b, e.bend ?? 0)} />;
          })}
        </defs>

        {/* Доли: мягкие пятна за группами узлов. */}
        {clusters.map((c) => (
          <g key={c.title} color={COLOR[c.tone]}>
            <ellipse cx={c.x} cy={c.y} rx={c.rx} ry={c.ry} fill="url(#lobe)" />
            {/* Подписи стоят одной верхней полосой, а не над центром пятна:
                так сразу читается, что поток идёт слева направо. */}
            <text x={c.x} y={26} textAnchor="middle" fontSize="10.5"
                  letterSpacing="2.4" fill="var(--txt-faint)">
              {c.title.toUpperCase()}
            </text>
          </g>
        ))}

        {/* Нервная ткань: фон, не данные. Намеренно очень тусклый. */}
        <g stroke="#4d7ba8" strokeOpacity={0.12} strokeWidth={0.6}>
          {MESH.links.map((l, i) => {
            const p = MESH.pts[l.a] as { x: number; y: number };
            const q = MESH.pts[l.b] as { x: number; y: number };
            return <line key={`m${i}`} x1={p.x} y1={p.y} x2={q.x} y2={q.y} />;
          })}
        </g>
        <g fill="#5f92c4" fillOpacity={0.2}>
          {MESH.pts.map((p, i) => <circle key={`mp${i}`} cx={p.x} cy={p.y} r={p.r} />)}
        </g>

        {/* Синапсы. Импульсы бегут только по живым связям. */}
        {edges.map((e, i) => {
          const a = byId.get(e.from);
          const b = byId.get(e.to);
          if (!a || !b) return null;
          const flowing = a.state !== "idle" && b.state !== "idle";
          const c = e.feedback ? COLOR.think : COLOR[a.state];
          return (
            <g key={`e${i}`}>
              <path
                d={arc(a, b, e.bend ?? 0)}
                fill="none"
                stroke={c}
                strokeOpacity={flowing ? (e.feedback ? 0.22 : 0.34) : 0.1}
                strokeWidth={e.feedback ? 1.2 : 2}
                strokeDasharray={e.feedback ? "3 8" : undefined}
                strokeLinecap="round"
              />
              {/* opacity=0 до старта — обязательно. animateMotion смещает
                  элемент ОТНОСИТЕЛЬНО его собственных координат, поэтому до
                  начала своей анимации кружок висит в точке (0,0), и с
                  drop-shadow это давало светящуюся кляксу в углу схемы. */}
              {flowing && !e.feedback && [0, 1.5].map((delay, k) => {
                const begin = `${(delay + i * 0.25).toFixed(2)}s`;
                return (
                  <circle key={k} r={3.1} fill={c} className="impulse" opacity={0}>
                    <animateMotion dur="3s" begin={begin} repeatCount="indefinite">
                      <mpath href={`#edge-${i}`} />
                    </animateMotion>
                    <set attributeName="opacity" to="1" begin={begin} />
                  </circle>
                );
              })}
            </g>
          );
        })}

        {/* Нейроны. */}
        {nodes.map((n) => {
          const c = COLOR[n.state];
          const still = n.state === "idle";
          const r = n.big ? 26 : 18;
          return (
            <g key={n.id} color={c} className={still ? "neuron neuron-still" : "neuron"}>
              <g stroke={c} strokeOpacity={still ? 0.14 : 0.36} strokeWidth={1.1} fill="none"
                 strokeLinecap="round">
                {dendrites(n, r).map((d, k) => <path key={k} d={d} />)}
              </g>

              <circle cx={n.x} cy={n.y} r={r * 2.7} fill="url(#soma)" className="soma-halo" />
              <circle cx={n.x} cy={n.y} r={r} fill="rgba(4,7,14,0.92)" stroke={c}
                      strokeOpacity={0.9} strokeWidth={n.big ? 2 : 1.4} className="soma-core" />
              <circle cx={n.x} cy={n.y} r={r * 0.32} fill={c} fillOpacity={still ? 0.3 : 1} />

              <text x={n.x} y={n.y + r + 21} textAnchor="middle"
                    fontSize={n.big ? 19 : 15} fontWeight="700" fill={c}
                    style={{ fontVariantNumeric: "tabular-nums" }}>
                {n.value ?? "нет данных"}
              </text>
              <text x={n.x} y={n.y + r + 37} textAnchor="middle" fontSize="11.5" fontWeight="600"
                    fill="var(--txt)">
                {n.label}
              </text>
              {n.hint && (
                <text x={n.x} y={n.y + r + 50} textAnchor="middle" fontSize="9.5"
                      fill="var(--txt-faint)">
                  {n.hint}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      <p className="mt-1 px-1 text-[11px]" style={{ color: "var(--txt-dim)" }}>
        Импульс бежит по связи, только когда через неё реально идут данные. Погасший
        неподвижный узел — это остановка на участке, а не приём оформления.
      </p>
    </div>
  );
}
