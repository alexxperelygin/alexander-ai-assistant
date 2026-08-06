// Исследование edge на всех накопленных данных (ops-задача "research",
// результат публикуется в status/research.md).
//
// Идея: не ограничиваться десятками READY-сигналов. Таблица снапшотов хранит
// рыночное состояние тысяч токенов во множестве моментов, значит можно
// построить выборку «признаки в момент T → чистый результат через 1ч/6ч/24ч
// после издержек» и проверить, есть ли в данных предсказательная сила вообще.
//
// Методическая честность (v2, после первого прогона):
//  * СРЕДНЕЕ на мем-коинах бессмысленно: одно наблюдение с ×1000 перекрывает
//    тысячи обычных. Основная метрика — МЕДИАНА и доля прибыльных; среднее
//    приводится только винзоризованным (обрезка хвостов по 1-му и 99-му перцентилю).
//  * Выбросы часто не рынок, а данные (смена пула у токена, копеечная цена,
//    сбой источника) — extreme-наблюдения выводятся отдельно для диагностики.
//  * Главная ловушка — systematic bias: измеримы только токены, которые
//    сканер продолжал опрашивать, а он приоритизирует «интересные». Поэтому
//    для каждого правила печатается COVERAGE — доля наблюдений с измеримым
//    исходом. Высокий coverage у правила при низком у базы = результат
//    правила завышен выживаемостью, а не предсказанием.
import { prisma } from "../src/lib/db";
import { simulateFill } from "../src/lib/paper/execution";

const POSITION_USD = 50;
const HORIZONS: Record<string, number> = { "1h": 60, "6h": 360, "24h": 1440 };
const MAIN_H = "6h";

// Момент, с которого сканер начал целенаправленно доопрашивать «неинтересные»
// токены (follow-up-слоты, деплой 5 августа ~08:45 UTC). До него исход был
// измерим почти только у выживших — любая метрика на тех данных завышена
// выживаемостью. Всё, что раньше этой границы, считается СМЕЩЁННЫМ режимом
// и выводится отдельно, а не смешивается с чистыми данными.
const UNBIASED_FROM = new Date(process.env.UNBIASED_FROM ?? "2026-08-05T09:00:00Z");

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
  return (buy.quantity * sell.effectivePriceUsd - sell.feesUsd) / POSITION_USD - 1;
}

const pct = (v: number | null | undefined, d = 1): string =>
  v == null || !Number.isFinite(v) ? "—" : `${(v * 100).toFixed(d)}%`;
const mean = (xs: number[]): number | null =>
  xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
function quantile(sorted: number[], q: number): number {
  if (!sorted.length) return 0;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))));
  return sorted[i] as number;
}
const median = (xs: number[]): number | null =>
  xs.length ? quantile([...xs].sort((a, b) => a - b), 0.5) : null;
/** Среднее после обрезки хвостов — устойчиво к единичным ×1000. */
function winsorMean(xs: number[]): number | null {
  if (xs.length < 20) return mean(xs);
  const s = [...xs].sort((a, b) => a - b);
  const lo = quantile(s, 0.01), hi = quantile(s, 0.99);
  return mean(s.map((v) => Math.min(hi, Math.max(lo, v))));
}
const winRate = (xs: number[]): number | null =>
  xs.length ? xs.filter((r) => r > 0).length / xs.length : null;

const out: string[] = [];
const log = (s = "") => out.push(s);

// ---------- Загрузка ----------
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

log(`# Исследование edge — ${new Date().toISOString()}`);
log();
log(`Окно: 7 дней. Снапшотов: ${rows.length.toLocaleString("ru")}, токенов: ${byToken.size.toLocaleString("ru")}.`);
log();
log(`> Основная метрика — **медиана** и **доля прибыльных**. Среднее по мем-коинам`);
log(`> нерепрезентативно (единичные ×1000 перекрывают тысячи наблюдений), поэтому`);
log(`> приводится винзоризованное среднее (хвосты обрезаны по 1%/99%).`);
log();

// ---------- Наблюдения ----------
interface Obs {
  entry: Snap;
  ret: Record<string, number | null>;
  /** Ликвидность на выходе MAIN_H упала ниже 20% от входной. null = не измерено. */
  rug: boolean | null;
}
const observations: Obs[] = [];
for (const series of byToken.values()) {
  if (series.length < 2) {
    // Токен без последующих наблюдений: исход неизмерим, но он ВАЖЕН для
    // оценки систематической ошибки — учитываем как непокрытый.
    const only = series[0];
    if (only) observations.push({ entry: only, ret: { "1h": null, "6h": null, "24h": null }, rug: null });
    continue;
  }
  for (let i = 0; i < series.length; i++) {
    const entry = series[i] as Snap;
    const ret: Record<string, number | null> = {};
    let rug: boolean | null = null;
    for (const [key, minutes] of Object.entries(HORIZONS)) {
      const deadline = entry.fetchedAt.getTime() + minutes * 60_000;
      const halfway = entry.fetchedAt.getTime() + (minutes * 60_000) / 2;
      let exit: Snap | null = null;
      for (let j = i + 1; j < series.length; j++) {
        const t = (series[j] as Snap).fetchedAt.getTime();
        if (t > deadline) break;
        if (t >= halfway) exit = series[j] as Snap;
      }
      ret[key] = exit ? netReturn(entry, exit) : null;
      if (key === MAIN_H && exit && exit.liquidityUsd != null && entry.liquidityUsd != null) {
        rug = exit.liquidityUsd < entry.liquidityUsd * 0.2;
      }
    }
    observations.push({ entry, ret, rug });
  }
}

const isUnbiased = (o: Obs) => o.entry.fetchedAt.getTime() >= UNBIASED_FROM.getTime();

// ---------- 1. Базовая линия ----------
log(`## 1. Базовая линия рынка`);
log();
log(`Всего наблюдений: ${observations.length.toLocaleString("ru")}.`);
log();
log(`| Горизонт | Измеримо | Coverage | Медиана | Винз. среднее | Прибыльных |`);
log(`|---|---|---|---|---|---|`);
for (const h of Object.keys(HORIZONS)) {
  const xs = observations.map((o) => o.ret[h]).filter((r): r is number => r != null);
  log(`| ${h} | ${xs.length} | ${pct(xs.length / observations.length, 0)} | **${pct(median(xs))}** | ${pct(winsorMean(xs))} | ${pct(winRate(xs), 0)} |`);
}
log();

// ---------- 1b. Режим измерения ----------
// Данные до UNBIASED_FROM собраны сканером, который доопрашивал в основном
// «интересные» токены, поэтому исход там измерим преимущественно у выживших.
// Смешивать два режима нельзя: это даёт оптимистичную базовую линию.
const unbiased = observations.filter(isUnbiased);
const biased = observations.filter((o) => !isUnbiased(o));
const covOf = (obs: Obs[]) => (obs.length ? obs.filter((o) => o.ret[MAIN_H] != null).length / obs.length : 0);
const retsOf = (obs: Obs[]) => obs.map((o) => o.ret[MAIN_H]).filter((r): r is number => r != null);

log(`## 1b. Режим измерения`);
log();
log(`Граница чистых данных: **${UNBIASED_FROM.toISOString()}** — момент, с которого`);
log(`сканер доопрашивает и «неинтересные» токены. До неё исход измерим почти`);
log(`только у выживших, и любая метрика завышена.`);
log();
log(`| Режим | Наблюдений | Coverage ${MAIN_H} | Медиана | Прибыльных |`);
log(`|---|---|---|---|---|`);
for (const [name, obs] of [["смещённый (до)", biased], ["чистый (после)", unbiased]] as const) {
  const xs = retsOf(obs);
  log(`| ${name} | ${obs.length.toLocaleString("ru")} | ${pct(covOf(obs), 0)} | **${pct(median(xs))}** | ${pct(winRate(xs), 0)} |`);
}
log();

// Дальнейший анализ идёт по чистому режиму, если его уже достаточно.
const MIN_CLEAN = 5_000;
const useClean = unbiased.length >= MIN_CLEAN;
const sample = useClean ? unbiased : observations;
log(useClean
  ? `Разделы 2–5 считаются **только по чистому режиму** (${sample.length.toLocaleString("ru")} наблюдений).`
  : `Чистых наблюдений пока ${unbiased.length.toLocaleString("ru")} (< ${MIN_CLEAN.toLocaleString("ru")}), ` +
    `поэтому разделы 2–5 считаются по всему окну и **завышены выживаемостью**.`);
log();

// ---------- 2. Диагностика выбросов ----------
const withMain = sample.filter((o) => o.ret[MAIN_H] != null);
const extremes = [...withMain].sort((a, b) => (b.ret[MAIN_H] as number) - (a.ret[MAIN_H] as number)).slice(0, 5);
log(`## 2. Диагностика экстремумов (топ-5 по ${MAIN_H})`);
log();
log(`Проверка, рынок это или мусор в данных (смена пула/сбой источника).`);
log();
for (const e of extremes) {
  log(`- +${((e.ret[MAIN_H] as number) * 100).toFixed(0)}%: цена входа $${e.entry.priceUsd.toPrecision(3)}, ` +
      `ликв $${Math.round(e.entry.liquidityUsd ?? 0).toLocaleString("ru")}, Δ1ч ${e.entry.priceChange1h ?? "—"}%, Δ24ч ${e.entry.priceChange24h ?? "—"}%`);
}
log();

// ---------- 3. Признаки по квинтилям ----------
log(`## 3. Предсказательная сила признаков (${MAIN_H}, медианы по квинтилям)`);
log();
const feats: { name: string; get: (s: Snap) => number | null }[] = [
  { name: "ликвидность $", get: (s) => s.liquidityUsd },
  { name: "объём 24ч $", get: (s) => s.volume24hUsd },
  { name: "Δ цены 1ч %", get: (s) => s.priceChange1h },
  { name: "Δ цены 24ч %", get: (s) => s.priceChange24h },
  { name: "buy/sell 1ч", get: (s) => (s.buys1h != null && s.sells1h != null ? s.buys1h / Math.max(s.sells1h, 1) : null) },
  { name: "сделок 1ч", get: (s) => (s.buys1h != null && s.sells1h != null ? s.buys1h + s.sells1h : null) },
  { name: "оборот vol/liq", get: (s) => (s.volume24hUsd != null && s.liquidityUsd ? s.volume24hUsd / s.liquidityUsd : null) },
  { name: "fdv/liq", get: (s) => (s.fdvUsd != null && s.liquidityUsd ? s.fdvUsd / s.liquidityUsd : null) },
  { name: "ускорение объёма", get: (s) => (s.volume5mUsd != null && s.volume1hUsd ? (s.volume5mUsd * 12) / s.volume1hUsd : null) },
];

function fmtNum(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(0)}k`;
  if (Math.abs(v) >= 10) return v.toFixed(0);
  return v.toFixed(2);
}

log(`| Признак | Q1 (низ) | Q2 | Q3 | Q4 | Q5 (верх) |`);
log(`|---|---|---|---|---|---|`);
for (const f of feats) {
  const pairs = withMain
    .map((o) => ({ v: f.get(o.entry), r: o.ret[MAIN_H] as number }))
    .filter((p): p is { v: number; r: number } => p.v != null && Number.isFinite(p.v));
  if (pairs.length < 500) { log(`| ${f.name} | мало данных (${pairs.length}) | | | | |`); continue; }
  pairs.sort((a, b) => a.v - b.v);
  const q = Math.floor(pairs.length / 5);
  const cells = [] as string[];
  for (let k = 0; k < 5; k++) {
    const slice = pairs.slice(k * q, k === 4 ? pairs.length : (k + 1) * q);
    cells.push(`${pct(median(slice.map((p) => p.r)))}<br><sub>${fmtNum(slice[0]?.v ?? 0)}–${fmtNum(slice[slice.length - 1]?.v ?? 0)}</sub>`);
  }
  log(`| ${f.name} | ${cells.join(" | ")} |`);
}
log();

// ---------- 4. Правила отбора ----------
log(`## 4. Правила отбора (${MAIN_H})`);
log();
log(`**Coverage** — доля наблюдений правила с измеримым исходом. Если у правила`);
log(`coverage сильно выше базовой линии, его результат завышен выживаемостью:`);
log(`измеряются только «дожившие» токены. Это главный риск ложного edge.`);
log();
log(`Дополнительно снимаются две методические ловушки:`);
log(`* **дедупликация по токенам** — пампящий токен даёт десятки наблюдений подряд,`);
log(`  и все они «выигрышные»; это раздувает мнимое преимущество. Берётся первое`);
log(`  подходящее наблюдение на токен, то есть одна сделка = один токен;`);
log(`* **train/test по времени** — правила подбираются на первых 70% окна,`);
log(`  проверяются на последних 30%. Если на test преимущество исчезает — это была подгонка.`);
log();

const times = sample.map((o) => o.entry.fetchedAt.getTime()).sort((a, b) => a - b);
const splitAt = times.length ? (times[Math.floor(times.length * 0.7)] as number) : 0;

/** Одно наблюдение на токен: убирает автокорреляцию внутри одного движения. */
function dedupByToken(obs: Obs[]): Obs[] {
  const seen = new Set<string>();
  const res: Obs[] = [];
  for (const o of obs) {
    if (seen.has(o.entry.tokenId)) continue;
    seen.add(o.entry.tokenId);
    res.push(o);
  }
  return res;
}

function statLine(obs: Obs[]): { n: number; med: number | null; win: number | null } {
  const xs = obs.map((o) => o.ret[MAIN_H]).filter((r): r is number => r != null);
  return { n: xs.length, med: median(xs), win: winRate(xs) };
}

log(`| Правило | Всего | Измеримо | Coverage | Медиана | Винз. среднее | Прибыльных | Rug |`);
log(`|---|---|---|---|---|---|---|---|`);

const rules: { name: string; ok: (s: Snap) => boolean }[] = [
  { name: "все (базовая линия)", ok: () => true },
  { name: "ликвидность > $50k", ok: (s) => (s.liquidityUsd ?? 0) > 50_000 },
  { name: "ликвидность > $200k", ok: (s) => (s.liquidityUsd ?? 0) > 200_000 },
  { name: "Δ1ч < 0 (откат)", ok: (s) => (s.priceChange1h ?? 0) < 0 },
  { name: "Δ1ч > +20% (рост)", ok: (s) => (s.priceChange1h ?? 0) > 20 },
  { name: "Δ24ч < 0", ok: (s) => (s.priceChange24h ?? 0) < 0 },
  { name: "Δ24ч > +100%", ok: (s) => (s.priceChange24h ?? 0) > 100 },
  { name: "buy/sell > 1.5", ok: (s) => (s.buys1h != null && s.sells1h != null ? s.buys1h / Math.max(s.sells1h, 1) : 0) > 1.5 },
  { name: "buy/sell < 1.0", ok: (s) => (s.buys1h != null && s.sells1h != null ? s.buys1h / Math.max(s.sells1h, 1) : 99) < 1.0 },
  { name: "сделок 1ч > 500", ok: (s) => ((s.buys1h ?? 0) + (s.sells1h ?? 0)) > 500 },
  { name: "сделок 1ч > 2000", ok: (s) => ((s.buys1h ?? 0) + (s.sells1h ?? 0)) > 2000 },
  { name: "ликв>50k И Δ1ч>20%", ok: (s) => (s.liquidityUsd ?? 0) > 50_000 && (s.priceChange1h ?? 0) > 20 },
  { name: "ликв>50k И сделок>500 И buy/sell>1.5", ok: (s) => (s.liquidityUsd ?? 0) > 50_000 && ((s.buys1h ?? 0) + (s.sells1h ?? 0)) > 500 && (s.buys1h != null && s.sells1h != null ? s.buys1h / Math.max(s.sells1h, 1) : 0) > 1.5 },
];

/** Доля наблюдений, где ликвидность к MAIN_H обвалилась ниже 20% входной. */
const rugRate = (obs: Obs[]): number | null => {
  const known = obs.filter((o) => o.rug != null);
  return known.length ? known.filter((o) => o.rug).length / known.length : null;
};

const baseCoverage = withMain.length / sample.length;
for (const rule of rules) {
  const all = sample.filter((o) => rule.ok(o.entry));
  const xs = all.map((o) => o.ret[MAIN_H]).filter((r): r is number => r != null);
  const cov = all.length ? xs.length / all.length : 0;
  const flag = cov > baseCoverage * 1.3 ? " ⚠" : "";
  log(`| ${rule.name}${flag} | ${all.length} | ${xs.length} | ${pct(cov, 0)} | **${pct(median(xs))}** | ${pct(winsorMean(xs))} | ${pct(winRate(xs), 0)} | ${pct(rugRate(all), 0)} |`);
}
log();
log(`⚠ — coverage существенно выше базового: результат вероятно завышен выживаемостью.`);
log();

// ---------- 4b. Строгая проверка: 1 токен = 1 сделка, train/test ----------
log(`### Строгая проверка (одно наблюдение на токен, разделение по времени)`);
log();
log(`| Правило | TRAIN n | TRAIN медиана | TRAIN win | TEST n | TEST медиана | TEST win |`);
log(`|---|---|---|---|---|---|---|`);
for (const rule of rules) {
  const matched = sample.filter((o) => rule.ok(o.entry));
  const tr = dedupByToken(matched.filter((o) => o.entry.fetchedAt.getTime() <= splitAt));
  const te = dedupByToken(matched.filter((o) => o.entry.fetchedAt.getTime() > splitAt));
  const a = statLine(tr), b = statLine(te);
  log(`| ${rule.name} | ${a.n} | **${pct(a.med)}** | ${pct(a.win, 0)} | ${b.n} | **${pct(b.med)}** | ${pct(b.win, 0)} |`);
}
log();
log(`Доверять можно только правилу, у которого преимущество сохранилось на TEST`);
log(`при достаточном n. Расхождение TRAIN/TEST = подгонка под историю.`);
log();

// ---------- 4c. Ругпуллы ----------
// Rug здесь = ликвидность к концу горизонта упала ниже 20% от входной, то есть
// выйти по разумной цене было уже нельзя. Ключевой вопрос: рост rug rate в
// backtest — это ухудшение отбора или мы просто НАЧАЛИ ВИДЕТЬ обвалы, которые
// раньше не измерялись? Сравнение режимов отвечает на него прямо.
log(`## 4c. Ругпуллы (ликвидность < 20% входной к ${MAIN_H})`);
log();
log(`| Срез | Измеримо | Rug rate |`);
log(`|---|---|---|`);
const rugRow = (name: string, obs: Obs[]) => {
  const known = obs.filter((o) => o.rug != null);
  log(`| ${name} | ${known.length.toLocaleString("ru")} | **${pct(rugRate(obs), 1)}** |`);
};
rugRow("смещённый режим (до границы)", biased);
rugRow("чистый режим (после границы)", unbiased);
const liqBuckets: { name: string; lo: number; hi: number }[] = [
  { name: "ликв < $10k", lo: 0, hi: 10_000 },
  { name: "$10k–50k", lo: 10_000, hi: 50_000 },
  { name: "$50k–200k", lo: 50_000, hi: 200_000 },
  { name: "> $200k", lo: 200_000, hi: Infinity },
];
for (const b of liqBuckets) {
  rugRow(b.name, sample.filter((o) => {
    const l = o.entry.liquidityUsd;
    return l != null && l >= b.lo && l < b.hi;
  }));
}
log();
log(`Если rug rate в чистом режиме заметно выше, чем в смещённом, — обвалы не`);
log(`участились, а стали измеримыми: раньше умирающие токены просто выпадали из`);
log(`выборки. Разбивка по ликвидности показывает, где порог реально защищает.`);
log();

// ---------- 5. Вывод ----------
const baseXs = withMain.map((o) => o.ret[MAIN_H] as number);
log(`## 5. Итог`);
log();
log(`Базовая линия ${MAIN_H}: медиана **${pct(median(baseXs))}**, прибыльных ${pct(winRate(baseXs), 0)}, ` +
    `coverage ${pct(baseCoverage, 0)} (N=${baseXs.length}).`);
log();
log(`Правило имеет смысл, только если его медиана устойчиво выше базовой ПРИ сопоставимом coverage.`);
log();

console.log(out.join("\n"));
process.exit(0);
