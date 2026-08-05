// Исследование edge на всех накопленных данных (запускается на сервере через
// ops-задачу "research", результат публикуется в status/research.md).
//
// Ключевая идея: не ограничиваться 20 READY-сигналами. Таблица снапшотов
// хранит рыночное состояние тысяч токенов во множестве моментов времени —
// значит, можно построить полноценную выборку наблюдений «признаки в момент T →
// чистый результат через 6ч/24ч после издержек» и проверить, есть ли в данных
// вообще предсказательная сила, до всякого скоринга.
//
// Честность: издержки считаются той же моделью simulateFill, что и в проде;
// исход берётся только по наблюдениям СТРОГО после T и не позже дедлайна
// горизонта, с требованием наблюдения во второй половине окна (иначе null).
import { prisma } from "../src/lib/db";
import { simulateFill } from "../src/lib/paper/execution";

const POSITION_USD = 50;
const HORIZONS: Record<string, number> = { "1h": 60, "6h": 360, "24h": 1440 };

interface Snap {
  tokenId: string;
  fetchedAt: Date;
  priceUsd: number;
  liquidityUsd: number | null;
  volume24hUsd: number | null;
  volume1hUsd: number | null;
  volume5mUsd: number | null;
  buys1h: number | null;
  sells1h: number | null;
  priceChange1h: number | null;
  priceChange24h: number | null;
  fdvUsd: number | null;
}

/** Чистая доходность после издержек входа и выхода, либо null если неизмеримо. */
function netReturn(entry: Snap, exit: Snap): number | null {
  const buy = simulateFill({
    sideUsd: POSITION_USD, priceUsd: entry.priceUsd,
    liquidityUsd: entry.liquidityUsd, direction: "buy",
  });
  if (!buy.executed) return null;
  const exitValue = buy.quantity * exit.priceUsd;
  const sell = simulateFill({
    sideUsd: exitValue, priceUsd: exit.priceUsd,
    liquidityUsd: exit.liquidityUsd, direction: "sell",
  });
  if (!sell.executed) return null;
  const proceeds = buy.quantity * sell.effectivePriceUsd - sell.feesUsd;
  return proceeds / POSITION_USD - 1;
}

function pct(v: number | null | undefined, d = 1): string {
  return v == null || !Number.isFinite(v) ? "—" : `${(v * 100).toFixed(d)}%`;
}
function mean(xs: number[]): number | null {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}
function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? (s[m] as number) : ((s[m - 1] as number) + (s[m] as number)) / 2;
}

const out: string[] = [];
const log = (s = "") => out.push(s);

// ---------- 1. Загрузка данных ----------
const since = new Date(Date.now() - 7 * 24 * 3600_000);
const rows = await prisma.tokenSnapshot.findMany({
  where: { dataMode: "live", fetchedAt: { gte: since }, priceUsd: { gt: 0 } },
  select: {
    tokenId: true, fetchedAt: true, priceUsd: true, liquidityUsd: true,
    volume24hUsd: true, volume1hUsd: true, volume5mUsd: true,
    buys1h: true, sells1h: true, priceChange1h: true, priceChange24h: true, fdvUsd: true,
  },
  orderBy: { fetchedAt: "asc" },
  take: 400_000,
});

const byToken = new Map<string, Snap[]>();
for (const r of rows) {
  const s = r as unknown as Snap;
  const arr = byToken.get(s.tokenId);
  if (arr) arr.push(s); else byToken.set(s.tokenId, [s]);
}
const multi = [...byToken.values()].filter((a) => a.length >= 2);

log(`# Исследование edge — ${new Date().toISOString()}`);
log();
log(`Окно: последние 7 дней. Снапшотов: ${rows.length.toLocaleString("ru")}, токенов: ${byToken.size.toLocaleString("ru")}, ` +
    `из них с ≥2 наблюдениями (измеримые): ${multi.length.toLocaleString("ru")}.`);
log();

// ---------- 2. Построение наблюдений ----------
interface Obs {
  entry: Snap;
  ret: Record<string, number | null>;
}
const observations: Obs[] = [];
for (const series of multi) {
  for (let i = 0; i < series.length; i++) {
    const entry = series[i] as Snap;
    const ret: Record<string, number | null> = {};
    let any = false;
    for (const [key, minutes] of Object.entries(HORIZONS)) {
      const deadline = entry.fetchedAt.getTime() + minutes * 60_000;
      const halfway = entry.fetchedAt.getTime() + (minutes * 60_000) / 2;
      let exit: Snap | null = null;
      for (let j = i + 1; j < series.length; j++) {
        const t = (series[j] as Snap).fetchedAt.getTime();
        if (t > deadline) break;
        if (t >= halfway) exit = series[j] as Snap;
      }
      const r = exit ? netReturn(entry, exit) : null;
      ret[key] = r;
      if (r != null) any = true;
    }
    if (any) observations.push({ entry, ret });
  }
}

log(`## 1. Базовая линия рынка (все наблюдения, не только сигналы)`);
log();
log(`Измеримых наблюдений: ${observations.length.toLocaleString("ru")}.`);
log();
log(`| Горизонт | N | Средняя чистая | Медиана | Доля прибыльных |`);
log(`|---|---|---|---|---|`);
for (const h of Object.keys(HORIZONS)) {
  const xs = observations.map((o) => o.ret[h]).filter((r): r is number => r != null);
  const wins = xs.filter((r) => r > 0).length;
  log(`| ${h} | ${xs.length} | ${pct(mean(xs))} | ${pct(median(xs))} | ${xs.length ? pct(wins / xs.length, 0) : "—"} |`);
}
log();
log(`Это ответ на главный вопрос: сколько теряет «слепая» покупка случайного ` +
    `просканированного токена после издержек. С этим и надо сравнивать стратегию.`);
log();

// ---------- 3. Предсказательная сила признаков ----------
log(`## 2. Предсказательная сила признаков (горизонт 6ч)`);
log();
log(`Наблюдения делятся на 5 равных групп по значению признака (Q1 — низшие 20%, Q5 — высшие).`);
log(`Если признак предсказывает, средняя доходность по группам должна монотонно меняться.`);
log();

const feats: { name: string; get: (s: Snap) => number | null }[] = [
  { name: "liquidityUsd", get: (s) => s.liquidityUsd },
  { name: "volume24hUsd", get: (s) => s.volume24hUsd },
  { name: "priceChange1h %", get: (s) => s.priceChange1h },
  { name: "priceChange24h %", get: (s) => s.priceChange24h },
  { name: "buy/sell ratio 1h", get: (s) => (s.buys1h != null && s.sells1h != null ? s.buys1h / Math.max(s.sells1h, 1) : null) },
  { name: "txns 1h", get: (s) => (s.buys1h != null && s.sells1h != null ? s.buys1h + s.sells1h : null) },
  { name: "vol/liq (24h)", get: (s) => (s.volume24hUsd != null && s.liquidityUsd ? s.volume24hUsd / s.liquidityUsd : null) },
  { name: "fdv/liq", get: (s) => (s.fdvUsd != null && s.liquidityUsd ? s.fdvUsd / s.liquidityUsd : null) },
  { name: "vol accel (5m×12/1h)", get: (s) => (s.volume5mUsd != null && s.volume1hUsd ? (s.volume5mUsd * 12) / s.volume1hUsd : null) },
];

const H = "6h";
for (const f of feats) {
  const pairs = observations
    .map((o) => ({ v: f.get(o.entry), r: o.ret[H] }))
    .filter((p): p is { v: number; r: number } => p.v != null && Number.isFinite(p.v) && p.r != null);
  if (pairs.length < 100) {
    log(`**${f.name}**: мало данных (${pairs.length})`);
    log();
    continue;
  }
  pairs.sort((a, b) => a.v - b.v);
  const q = Math.floor(pairs.length / 5);
  const cells: string[] = [];
  for (let k = 0; k < 5; k++) {
    const slice = pairs.slice(k * q, k === 4 ? pairs.length : (k + 1) * q);
    const m = mean(slice.map((p) => p.r));
    const lo = slice[0]?.v ?? 0;
    const hi = slice[slice.length - 1]?.v ?? 0;
    cells.push(`Q${k + 1} [${fmtNum(lo)}..${fmtNum(hi)}]: **${pct(m)}**`);
  }
  // Корреляция Пирсона как сводный показатель (на рангах — устойчивее к выбросам).
  const n = pairs.length;
  const ranksV = new Map<number, number>();
  pairs.forEach((p, i) => ranksV.set(i, i));
  const byRet = [...pairs].map((p, i) => ({ i, r: p.r })).sort((a, b) => a.r - b.r);
  const ranksR = new Array(n).fill(0);
  byRet.forEach((x, rank) => { ranksR[x.i] = rank; });
  let sumd2 = 0;
  for (let i = 0; i < n; i++) sumd2 += (i - ranksR[i]) ** 2;
  const rho = 1 - (6 * sumd2) / (n * (n * n - 1));
  log(`**${f.name}** (N=${n}, ранговая корреляция с исходом: ${rho.toFixed(3)})`);
  log(cells.join(" · "));
  log();
}

function fmtNum(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(0)}k`;
  if (Math.abs(v) >= 10) return v.toFixed(0);
  return v.toFixed(2);
}

// ---------- 4. Проверка правил отбора ----------
log(`## 3. Проверка правил отбора (горизонт 6ч)`);
log();
log(`Что было бы, если покупать только наблюдения, проходящие фильтр.`);
log();
log(`| Правило | N | Средняя чистая | Медиана | Прибыльных |`);
log(`|---|---|---|---|---|`);

const rules: { name: string; ok: (s: Snap) => boolean }[] = [
  { name: "все наблюдения (baseline)", ok: () => true },
  { name: "ликвидность > $50k", ok: (s) => (s.liquidityUsd ?? 0) > 50_000 },
  { name: "ликвидность > $200k", ok: (s) => (s.liquidityUsd ?? 0) > 200_000 },
  { name: "Δ1ч < 0 (покупка на откате)", ok: (s) => (s.priceChange1h ?? 0) < 0 },
  { name: "Δ1ч > +20% (покупка на росте)", ok: (s) => (s.priceChange1h ?? 0) > 20 },
  { name: "Δ24ч < 0 (упавшие за сутки)", ok: (s) => (s.priceChange24h ?? 0) < 0 },
  { name: "Δ24ч > +100%", ok: (s) => (s.priceChange24h ?? 0) > 100 },
  { name: "buy/sell > 1.5", ok: (s) => (s.buys1h != null && s.sells1h != null ? s.buys1h / Math.max(s.sells1h, 1) : 0) > 1.5 },
  { name: "buy/sell < 1.0 (продавцы)", ok: (s) => (s.buys1h != null && s.sells1h != null ? s.buys1h / Math.max(s.sells1h, 1) : 99) < 1.0 },
  { name: "txns 1h > 500", ok: (s) => ((s.buys1h ?? 0) + (s.sells1h ?? 0)) > 500 },
  { name: "vol/liq 24h в [1..10]", ok: (s) => { const v = s.volume24hUsd != null && s.liquidityUsd ? s.volume24hUsd / s.liquidityUsd : -1; return v >= 1 && v <= 10; } },
  { name: "ликв>50k И Δ1ч<0", ok: (s) => (s.liquidityUsd ?? 0) > 50_000 && (s.priceChange1h ?? 0) < 0 },
  { name: "ликв>50k И Δ1ч>20%", ok: (s) => (s.liquidityUsd ?? 0) > 50_000 && (s.priceChange1h ?? 0) > 20 },
];

for (const rule of rules) {
  const xs = observations
    .filter((o) => rule.ok(o.entry))
    .map((o) => o.ret[H])
    .filter((r): r is number => r != null);
  const wins = xs.filter((r) => r > 0).length;
  log(`| ${rule.name} | ${xs.length} | **${pct(mean(xs))}** | ${pct(median(xs))} | ${xs.length ? pct(wins / xs.length, 0) : "—"} |`);
}
log();

// ---------- 5. Итог ----------
const baseXs = observations.map((o) => o.ret[H]).filter((r): r is number => r != null);
const baseMean = mean(baseXs);
log(`## 4. Вывод`);
log();
log(`Средняя чистая доходность произвольного наблюдения на 6ч: **${pct(baseMean)}** ` +
    `(N=${baseXs.length}). Любое правило отбора имеет смысл только если оно устойчиво ` +
    `лучше этой цифры на большой выборке.`);
log();

console.log(out.join("\n"));
process.exit(0);
