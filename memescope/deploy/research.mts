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
import { FREEZE_AT, FROZEN_EXIT } from "../src/lib/paper/exit-policy";

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
  chain?: string;
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
  /** Изменение ликвидности к предыдущему снапшоту, % (вычисляется при загрузке). */
  liqTrendPct?: number | null;
  /** Социальный срез, известный на момент наблюдения (X). null = не измерялось. */
  socialMentions?: number | null;
  socialAuthors?: number | null;
  socialReach?: number | null;
  socialFreshShare?: number | null;
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
  // grossUsd уже учитывает комиссии и не может быть отрицательным: лонг теряет
  // максимум вложенное. Прежняя формула считала это вручную и на скачках цены
  // выдавала убытки в тысячи процентов.
  return sell.grossUsd / POSITION_USD - 1;
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

// Сеть хранится у токена, а не у снапшота: подтягиваем отдельно и проставляем,
// иначе разбивку по сетям не сделать.
const chainRows = await prisma.token.findMany({ select: { id: true, chain: true } });
const chainOf = new Map(chainRows.map((t) => [t.id, t.chain]));

const byToken = new Map<string, Snap[]>();
for (const r of rows) {
  const s = r as unknown as Snap;
  s.chain = chainOf.get(s.tokenId) ?? "solana";
  const arr = byToken.get(s.tokenId);
  if (arr) arr.push(s); else byToken.set(s.tokenId, [s]);
}

// Динамика ликвидности на момент входа: уходящая ликвидность — главный признак
// готовящегося ругпулла, и она доступна ДО решения (сравнение с предыдущим
// собственным наблюдением, без заглядывания вперёд). Предыдущий снапшот
// учитывается, только если он не старше 2 часов, иначе «тренд» бессмыслен.
for (const series of byToken.values()) {
  for (let i = 1; i < series.length; i++) {
    const cur = series[i] as Snap, prev = series[i - 1] as Snap;
    const gapMin = (cur.fetchedAt.getTime() - prev.fetchedAt.getTime()) / 60_000;
    if (gapMin > 120 || !prev.liquidityUsd || cur.liquidityUsd == null) continue;
    cur.liqTrendPct = ((cur.liquidityUsd - prev.liquidityUsd) / prev.liquidityUsd) * 100;
  }
}

// ---------- Социальные данные ----------
// Привязываем к наблюдению ПОСЛЕДНИЙ соцзамер, сделанный НЕ ПОЗЖЕ него: иначе
// это было бы заглядыванием в будущее. Замер старше двух часов не используется —
// внимание в мем-коинах живёт минутами, а не сутками.
const SOCIAL_MAX_AGE_MS = 2 * 3600_000;
const socialRows = await prisma.socialSnapshot.findMany({
  where: { source: "x", fetchedAt: { gte: since } },
  select: {
    tokenId: true, fetchedAt: true, mentions: true, uniqueAuthors: true,
    reach: true, freshAccountShare: true,
  },
  orderBy: { fetchedAt: "asc" },
});
const socialByToken = new Map<string, typeof socialRows>();
for (const r of socialRows) {
  const arr = socialByToken.get(r.tokenId);
  if (arr) arr.push(r); else socialByToken.set(r.tokenId, [r]);
}
let socialMatched = 0;
for (const series of byToken.values()) {
  const social = socialByToken.get(series[0]?.tokenId ?? "");
  if (!social?.length) continue;
  let idx = 0;
  for (const snap of series) {
    while (idx + 1 < social.length && (social[idx + 1] as { fetchedAt: Date }).fetchedAt <= snap.fetchedAt) idx++;
    const cur = social[idx];
    if (!cur || cur.fetchedAt > snap.fetchedAt) continue;
    if (snap.fetchedAt.getTime() - cur.fetchedAt.getTime() > SOCIAL_MAX_AGE_MS) continue;
    snap.socialMentions = cur.mentions;
    snap.socialAuthors = cur.uniqueAuthors;
    snap.socialReach = cur.reach;
    snap.socialFreshShare = cur.freshAccountShare;
    socialMatched++;
  }
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

// Гигиена данных. В отчёте 6 августа четыре из пяти экстремумов имели Δ1ч,
// в точности равную Δ24ч, и обе — порядка +130 000%. Это не рынок: так
// выглядит пара, у которой в источнике меньше часа истории, поэтому оба окна
// покрывают один и тот же отрезок от стартовой цены. Такие наблюдения
// одновременно раздувают «моментум-правила» и портят их результат, поэтому
// исключаются с явным подсчётом, а не молча.
/**
 * Адрес пула, из которого взято наблюдение.
 *
 * Источник отдаёт по токену ЛУЧШУЮ пару, а «лучшая» со временем меняется:
 * ликвидность переезжает в другой пул, и котировка скачком переходит на его
 * цену. Для нас это выглядит как рост в десятки раз — только заработать на
 * нём было нельзя, потому что нашей позиции в новом пуле нет.
 *
 * Адрес пары не хранится отдельной колонкой, но лежит в сыром payload'е
 * снапшота. Разбираем регуляркой, а не JSON.parse: payload обрезан до 4000
 * символов, и на длинных ответах разбор падал бы — а нам нужно только одно
 * поле, которое стоит в начале.
 */
async function pairAddressAt(tokenId: string, at: Date): Promise<string | null> {
  const row = await prisma.tokenSnapshot.findFirst({
    where: { tokenId, fetchedAt: { lte: at } },
    orderBy: { fetchedAt: "desc" },
    select: { raw: true },
  });
  const m = row?.raw ? /"pairAddress":"([^"]+)"/.exec(row.raw) : null;
  return m?.[1] ?? null;
}

const isListingArtifact = (s: Snap): boolean =>
  s.priceChange1h != null && s.priceChange24h != null &&
  s.priceChange1h === s.priceChange24h && Math.abs(s.priceChange1h) > 1000;

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
const artifacts = observations.filter((o) => isListingArtifact(o.entry));
const clean = observations.filter((o) => !isListingArtifact(o.entry));
const unbiased = clean.filter(isUnbiased);
const biased = clean.filter((o) => !isUnbiased(o));
const covOf = (obs: Obs[]) => (obs.length ? obs.filter((o) => o.ret[MAIN_H] != null).length / obs.length : 0);
const retsOf = (obs: Obs[]) => obs.map((o) => o.ret[MAIN_H]).filter((r): r is number => r != null);

log(`## 1b. Режим измерения`);
log();
log(`Отброшено как артефакт листинга (Δ1ч в точности равна Δ24ч и обе > 1000%): ` +
    `**${artifacts.length.toLocaleString("ru")}** наблюдений из ${observations.length.toLocaleString("ru")}. ` +
    `У такой пары в источнике меньше часа истории, «рост» — это разница со стартовой ценой, а не моментум.`);
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

// ---------- 1c. По сетям ----------
// Главный вопрос мультичейна: одинаково ли устроен рынок в разных сетях.
// Если базовая линия и предсказуемость где-то заметно лучше — искать edge
// нужно там, а не там, где мы начали.
log(`## 1c. Разбивка по сетям (${MAIN_H})`);
log();
log(`Две таблицы, и вторая важнее. Базовая линия по всем наблюдениям включает`);
log(`пулы с копеечной ликвидностью, где позицию съедает проскальзывание — там`);
log(`«убыточно» означает «невозможно торговать», а не «рынок падает». Поэтому`);
log(`рядом даётся срез по той вселенной, которую система реально рассматривает:`);
log(`ликвидность выше порога.`);
log();

const chains = [...new Set(unbiased.map((o) => o.entry.chain ?? "solana"))].sort();
const chainRow = (obs: Obs[], label: string) => {
  const xs = retsOf(obs);
  const rugKnown = obs.filter((o) => o.rug != null);
  const rug = rugKnown.length ? rugKnown.filter((o) => o.rug).length / rugKnown.length : null;
  log(`| ${label} | ${obs.length.toLocaleString("ru")} | ${xs.length.toLocaleString("ru")} | ` +
      `${pct(covOf(obs), 0)} | **${pct(median(xs))}** | ${pct(winRate(xs), 0)} | ${pct(rug, 0)} |`);
};

log(`### Все наблюдения`);
log();
log(`| Сеть | Наблюдений | Измеримо | Coverage | Медиана | Прибыльных | Rug |`);
log(`|---|---|---|---|---|---|---|`);
for (const ch of chains) chainRow(unbiased.filter((o) => (o.entry.chain ?? "solana") === ch), ch);
log();

log(`### Только торгуемые: ликвидность > $50k`);
log();
log(`| Сеть | Наблюдений | Измеримо | Coverage | Медиана | Прибыльных | Rug |`);
log(`|---|---|---|---|---|---|---|`);
for (const ch of chains) {
  chainRow(
    unbiased.filter((o) => (o.entry.chain ?? "solana") === ch && (o.entry.liquidityUsd ?? 0) > 50_000),
    ch,
  );
}
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
  { name: "Δ ликвидности %", get: (s) => s.liqTrendPct ?? null },
  { name: "упоминаний в X", get: (s) => s.socialMentions ?? null },
  { name: "авторов в X", get: (s) => s.socialAuthors ?? null },
  { name: "охват в X", get: (s) => s.socialReach ?? null },
  { name: "доля свежих аккаунтов", get: (s) => s.socialFreshShare ?? null },
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
log(`Соцданные (X) привязаны к ${socialMatched.toLocaleString("ru")} наблюдениям —`);
log(`последний замер не позже наблюдения и не старше 2 часов. Если это число мало,`);
log(`строки про X ничего не доказывают: отсутствие данных не равно отсутствию связи.`);
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
  { name: "ликвидность растёт (Δликв > 0)", ok: (s) => (s.liqTrendPct ?? -1) > 0 },
  { name: "ликвидность утекает (Δликв < −5%)", ok: (s) => (s.liqTrendPct ?? 1) < -5 },
  { name: "ликв>50k И Δликв > −2%", ok: (s) => (s.liquidityUsd ?? 0) > 50_000 && (s.liqTrendPct ?? -99) > -2 },
  { name: "есть упоминания в X", ok: (s) => (s.socialMentions ?? 0) > 0 },
  { name: "упоминаний в X ≥ 3", ok: (s) => (s.socialMentions ?? 0) >= 3 },
  { name: "ликв>50k И есть упоминания", ok: (s) => (s.liquidityUsd ?? 0) > 50_000 && (s.socialMentions ?? 0) > 0 },
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

// ---------- 4d. Политики выхода ----------
// Здесь проверяется гипотеза, которую вся предыдущая методика не могла увидеть.
//
// До сих пор результат считался так: вошли и вышли РОВНО через фиксированный
// срок. При таком правиле прибыль ограничена сверху тем, что случилось к
// дедлайну, а мем-рынок устроен наоборот — распределение с толстым правым
// хвостом: подавляющее большинство токенов теряет почти всё, единицы дают
// десятки концов. На таком распределении МЕДИАНА почти обязана быть
// отрицательной даже у прибыльной стратегии, а решение принимается по СРЕДНЕМУ
// на портфель: девяносто мелких потерь окупаются одним крупным выигрышем.
//
// Значит искать надо не в отборе входа, а в правиле выхода: резать убыток
// быстро и не обрубать прибыль дедлайном. Именно это здесь и моделируется.
interface ExitPolicy {
  name: string;
  /** Жёсткий стоп от цены входа, доля (0.35 = −35%). */
  stopPct: number;
  /** Трейлинг от достигнутого максимума, доля. null = не используется. */
  trailPct: number | null;
  /** Предельное время удержания, минуты. */
  maxHoldMin: number;
  /** Аварийный выход, если ликвидность упала ниже этой доли от входной. */
  drainRatio?: number;
}

/** Прогоняет сделку по политике и возвращает чистый результат после издержек. */
function simulateExit(series: Snap[], i: number, policy: ExitPolicy): number | null {
  const entry = series[i] as Snap;
  const deadline = entry.fetchedAt.getTime() + policy.maxHoldMin * 60_000;
  let peak = entry.priceUsd;
  let exit: Snap | null = null;
  for (let j = i + 1; j < series.length; j++) {
    const p = series[j] as Snap;
    if (p.fetchedAt.getTime() > deadline) break;
    exit = p; // на случай, если ни одно условие не сработает — выходим по последнему
    if (p.priceUsd > peak) peak = p.priceUsd;
    if (p.priceUsd <= entry.priceUsd * (1 - policy.stopPct)) break;
    if (policy.trailPct != null && p.priceUsd <= peak * (1 - policy.trailPct)) break;
    // Аварийный выход по обвалу ликвидности. Он есть в живом мониторе, поэтому
    // без него отчёт считал бы не ту стратегию, которой торгует система.
    if (policy.drainRatio != null && entry.liquidityUsd != null && p.liquidityUsd != null &&
        p.liquidityUsd < entry.liquidityUsd * policy.drainRatio) break;
  }
  return exit ? netReturn(entry, exit) : null;
}

// Правила, по которым бумажный портфель торгует ПРЯМО СЕЙЧАС. Их надо
// измерять наравне с гипотезами, а не считать заданными: реализованный
// результат −$505 на 18 позициях требует объяснения, и лесенка тейков —
// первый подозреваемый. Она продаёт треть на 1.5x и треть на 2x, то есть
// обрубает ровно тот правый хвост, из которого, по разделу 4d, и берётся
// вся прибыль. Если так — портфель структурно режет выигрыши и оставляет
// убытки целиком.
const LIVE_LADDER: { multiple: number; fraction: number }[] = [
  { multiple: 1.5, fraction: 0.33 },
  { multiple: 2.0, fraction: 0.33 },
  { multiple: 4.0, fraction: 0.34 },
];

/**
 * Моделирует действующие правила монитора: аварийный выход при падении
 * ликвидности ниже 60% от входной, жёсткий стоп −35%, лесенка тейков.
 * Доли считаются от исходного объёма, издержки — как у остальных строк
 * (по полному размеру позиции), чтобы сравнение было честным.
 */
function simulateLiveLadder(series: Snap[], i: number, maxHoldMin = 4320): number | null {
  const entry = series[i] as Snap;
  const deadline = entry.fetchedAt.getTime() + maxHoldMin * 60_000;
  const entryLiq = entry.liquidityUsd;
  const taken = LIVE_LADDER.map(() => false);
  let remaining = 1;
  let total = 0;
  let last: Snap | null = null;
  for (let j = i + 1; j < series.length && remaining > 0; j++) {
    const p = series[j] as Snap;
    if (p.fetchedAt.getTime() > deadline) break;
    last = p;
    const isDrain = entryLiq != null && p.liquidityUsd != null && p.liquidityUsd < entryLiq * 0.6;
    if (isDrain || p.priceUsd <= entry.priceUsd * 0.65) {
      const r = netReturn(entry, p);
      if (r == null) return null;
      total += remaining * r;
      remaining = 0;
      break;
    }
    for (let k = 0; k < LIVE_LADDER.length; k++) {
      const step = LIVE_LADDER[k] as { multiple: number; fraction: number };
      if (taken[k] || p.priceUsd < entry.priceUsd * step.multiple) continue;
      const r = netReturn(entry, p);
      if (r == null) return null;
      const f = Math.min(remaining, step.fraction);
      total += f * r;
      remaining -= f;
      taken[k] = true;
    }
  }
  if (remaining > 0) {
    if (!last) return null;
    const r = netReturn(entry, last);
    if (r == null) return null;
    total += remaining * r;
  }
  return total;
}

const POLICIES: ExitPolicy[] = [
  { name: "фикс. выход через 6ч", stopPct: 1, trailPct: null, maxHoldMin: 360 },
  { name: "фикс. выход через 24ч", stopPct: 1, trailPct: null, maxHoldMin: 1440 },
  { name: "стоп −35%, держать до 24ч", stopPct: 0.35, trailPct: null, maxHoldMin: 1440 },
  { name: "стоп −20%, держать до 24ч", stopPct: 0.2, trailPct: null, maxHoldMin: 1440 },
  { name: "стоп −20% + трейлинг 30%", stopPct: 0.2, trailPct: 0.3, maxHoldMin: 1440 },
  { name: "стоп −35% + трейлинг 50%", stopPct: 0.35, trailPct: 0.5, maxHoldMin: 1440 },
  { name: "стоп −20% + трейлинг 30%, до 3д", stopPct: 0.2, trailPct: 0.3, maxHoldMin: 4320 },
];

/** Ровно то, чем торгует бумажный портфель после заморозки правил. Константы
 * общие с живым кодом (src/lib/paper/exit-policy.ts): если бы они дублировались,
 * отчёт рано или поздно проверял бы не ту стратегию, что работает на сервере. */
const FROZEN_POLICY: ExitPolicy = {
  name: "ЗАМОРОЖЕНО: стоп −20% + трейлинг 30% + выход по ликвидности, до 3д",
  stopPct: FROZEN_EXIT.stopPct,
  trailPct: FROZEN_EXIT.trailPct,
  maxHoldMin: FROZEN_EXIT.maxHoldMin,
  drainRatio: FROZEN_EXIT.liquidityFloorRatio,
};
POLICIES.push(FROZEN_POLICY);

log(`## 4d. Политики выхода: где на мем-коинах вообще берётся прибыль`);
log();
log(`Всё предыдущее считало результат по фиксированному сроку выхода. Это`);
log(`структурно не способно найти прибыль на рынке с толстым правым хвостом:`);
log(`большинство токенов теряет почти всё, единицы дают десятки концов, и`);
log(`медиана обязана быть отрицательной даже у прибыльной стратегии.`);
log();
log(`Портфель живёт по СРЕДНЕМУ, а не по медиане: девяносто мелких потерь`);
log(`окупаются одним крупным выигрышем. Поэтому здесь главная колонка — среднее,`);
log(`а медиана приводится как напоминание, что большинство сделок убыточно.`);
log();
log(`Вход один и тот же во всех строках (ликвидность > $50k, одно наблюдение на`);
log(`токен) — сравниваются ТОЛЬКО правила выхода.`);
log();

interface ExitEntry { series: Snap[]; i: number }
interface EntrySet { entries: ExitEntry[]; candidates: number; withoutForward: number }

/**
 * Собирает по одному входу на токен по заданным фильтрам.
 *
 * Вынесено в функцию не ради красоты: ровно та же процедура ниже запускается
 * с ДРУГИМИ фильтрами. Без такого сравнения нельзя отличить «отбор работает»
 * от «так ведёт себя любой токен» — а это разница между стратегией и
 * измерительным артефактом.
 */
function collectExitEntries(opts: {
  minLiquidityUsd: number;
  maxLiquidityUsd?: number;
  delayMin?: number;
}): EntrySet {
  const entries: ExitEntry[] = [];
  const seen = new Set<string>();
  // Воронка отбора. Без неё нельзя отличить «стратегия зарабатывает» от
  // «мы считаем только тех, за кем продолжали следить»: токен, умерший сразу
  // после входа и больше не опрошенный, просто не попадает в выборку и не
  // портит статистику. Это та же выживаемость, что уже дважды нас обманывала.
  let candidates = 0;
  let withoutForward = 0;
  for (const series of byToken.values()) {
    for (let i = 0; i < series.length; i++) {
      const e = series[i] as Snap;
      if (e.fetchedAt.getTime() < UNBIASED_FROM.getTime()) continue;
      if ((e.liquidityUsd ?? 0) <= opts.minLiquidityUsd) continue;
      if (opts.maxLiquidityUsd != null && (e.liquidityUsd ?? 0) > opts.maxLiquidityUsd) continue;
      // Артефакты листинга сюда попадать не должны. У четырёх из пяти лучших
      // сделок Δ1ч в точности равна Δ24ч — подпись пары, у которой в источнике
      // меньше часа истории. Цена входа в такой момент наименее надёжна, а
      // именно эти наблюдения и создавали весь положительный хвост.
      if (e.priceChange1h != null && e.priceChange24h != null &&
          e.priceChange1h === e.priceChange24h) continue;
      if (seen.has(e.tokenId)) continue;
      seen.add(e.tokenId);
      candidates++;
      // Задержка входа: отбор токена тот же самый, но покупаем не в момент
      // первого подходящего наблюдения, а через delayMin минут после него.
      let start = i;
      if (opts.delayMin) {
        const notBefore = e.fetchedAt.getTime() + opts.delayMin * 60_000;
        start = -1;
        for (let j = i + 1; j < series.length; j++) {
          if ((series[j] as Snap).fetchedAt.getTime() >= notBefore) { start = j; break; }
        }
        if (start < 0) { withoutForward++; break; }
      }
      if (start + 1 >= series.length) {
        withoutForward++; // вход есть, дальнейших наблюдений нет — исход неизмерим
        break;
      }
      entries.push({ series, i: start });
      break;
    }
  }
  return { entries, candidates, withoutForward };
}

/**
 * Доверительный интервал среднего бутстрапом. Нужен потому, что «+22% на 130
 * сделках» и «+22% на 13 000 сделках» — совершенно разные утверждения, а по
 * одному числу их не различить. Если интервал накрывает ноль, результат
 * неотличим от случайности, и никакие красивые проценты этого не меняют.
 * Генератор детерминированный: отчёт должен воспроизводиться.
 */
function bootstrapMeanCI(xs: number[], iters = 2000): [number, number] | null {
  if (xs.length < 20) return null;
  let seed = 12345;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  const means: number[] = [];
  for (let k = 0; k < iters; k++) {
    let s = 0;
    for (let j = 0; j < xs.length; j++) s += xs[Math.floor(rnd() * xs.length)] as number;
    means.push(s / xs.length);
  }
  means.sort((a, b) => a - b);
  return [quantile(means, 0.025), quantile(means, 0.975)];
}

/** Политика выхода как именованная функция: помимо параметрических правил
 * сюда попадает действующая живая лесенка, которую тоже надо мерить. */
interface NamedExit { name: string; run: (series: Snap[], i: number) => number | null }
const EXITS: NamedExit[] = [
  ...POLICIES.map((p): NamedExit => ({
    name: p.name,
    run: (series, i) => simulateExit(series, i, p),
  })),
  {
    name: "ТЕКУЩАЯ живая: стоп −35% + тейки 1.5x/2x/4x",
    run: (series, i) => simulateLiveLadder(series, i),
  },
];

function policyReturns(entries: ExitEntry[], exit: NamedExit): number[] {
  return entries
    .map((e) => exit.run(e.series, e.i))
    .filter((r): r is number => r != null);
}

/** Печатает таблицу по всем политикам выхода для одного набора входов. */
function logPolicyTable(entries: ExitEntry[], withCI: boolean): void {
  log(`| Политика выхода | Сделок | Среднее | ${withCI ? "95% интервал среднего | " : ""}Без лучшей сделки | Винз. среднее | Медиана | Прибыльных | Лучшая |`);
  log(`|---|---|---|${withCI ? "---|" : ""}---|---|---|---|---|`);
  for (const policy of EXITS) {
    const rs = policyReturns(entries, policy);
    if (rs.length < 20) {
      log(`| ${policy.name} | ${rs.length} | мало данных | ${withCI ? "| " : ""}| | | | |`);
      continue;
    }
    const sorted = [...rs].sort((a, b) => b - a);
    const best = sorted[0] as number;
    // Колонка «без лучшей сделки» — главная проверка на самообман. Если весь
    // плюс держится на одном наблюдении, стратегии нет: повторить единичное
    // событие нельзя, а следующая такая же выборка его просто не содержит.
    const withoutBest = mean(sorted.slice(1));
    const ci = withCI ? bootstrapMeanCI(rs) : null;
    const ciCell = withCI ? `${ci ? `${pct(ci[0], 0)} … ${pct(ci[1], 0)}` : "—"} | ` : "";
    log(`| ${policy.name} | ${rs.length} | **${pct(mean(rs))}** | ${ciCell}${pct(withoutBest)} | ${pct(winsorMean(rs))} | ` +
        `${pct(median(rs))} | ${pct(winRate(rs), 0)} | ${pct(best, 0)} |`);
  }
  log();
}

const candidateSet = collectExitEntries({ minLiquidityUsd: 50_000 });
const entriesForExit = candidateSet.entries;

log(`Воронка: подошло входов **${candidateSet.candidates}**, из них без единого наблюдения`);
log(`после входа — **${candidateSet.withoutForward}** (${pct(candidateSet.candidates ? candidateSet.withoutForward / candidateSet.candidates : 0, 0)}).`);
log(`Эти токены исключены не потому, что плохи, а потому что за ними перестали`);
log(`следить. Если их доля велика, весь плюс ниже может быть выживаемостью.`);
log();
log(`Колонка «95% интервал среднего» — бутстрап. Если интервал накрывает ноль,`);
log(`результат неотличим от случайности при этом числе сделок.`);
log();
logPolicyTable(entriesForExit, true);

// Разделение по времени: правило выхода, которое работает только на прошлой
// половине окна, — подгонка, а не стратегия.
{
  const times = entriesForExit
    .map((e) => (e.series[e.i] as Snap).fetchedAt.getTime())
    .sort((a, b) => a - b);
  const split = times.length ? (times[Math.floor(times.length * 0.7)] as number) : 0;
  log(`### Проверка на разных половинах окна`);
  log();
  // Колонки «без лучшей» обязательны именно здесь. На проверочной половине
  // всего несколько десятков сделок, и одного крупного выигрыша достаточно,
  // чтобы средняя выглядела убедительно. Если без него остаётся около нуля —
  // проверка не пройдена, сколько бы ни было в основной колонке.
  const dropBest = (xs: number[]): number | null =>
    xs.length > 1 ? mean([...xs].sort((a, b) => b - a).slice(1)) : null;
  log(`| Политика выхода | TRAIN n | TRAIN среднее | TRAIN без лучшей | TEST n | TEST среднее | TEST без лучшей |`);
  log(`|---|---|---|---|---|---|---|`);
  for (const policy of EXITS) {
    const tr: number[] = [], te: number[] = [];
    for (const e of entriesForExit) {
      const r = policy.run(e.series, e.i);
      if (r == null) continue;
      ((e.series[e.i] as Snap).fetchedAt.getTime() <= split ? tr : te).push(r);
    }
    log(`| ${policy.name} | ${tr.length} | **${pct(mean(tr))}** | ${pct(dropBest(tr))} | ` +
        `${te.length} | **${pct(mean(te))}** | ${pct(dropBest(te))} |`);
  }
  log();
  log(`Совпадение знака и порядка величины на обеих половинах — необходимое`);
  log(`условие. Расхождение означает, что результат случаен.`);
  log();
}

// Разбор крупнейших выигрышей: реальный ли это рост или артефакт данных.
// Именно на этом вопросе держится весь вывод про «прибыль в хвосте».
{
  const policy = POLICIES[POLICIES.length - 1] as ExitPolicy;
  const scored = entriesForExit
    .map((e) => ({ e, r: simulateExit(e.series, e.i, policy) }))
    .filter((x): x is { e: { series: Snap[]; i: number }; r: number } => x.r != null)
    .sort((a, b) => b.r - a.r)
    .slice(0, 5);
  log(`### Пять лучших сделок политики «${policy.name}»`);
  log();
  log(`Проверка, рынок это или мусор в данных. Скачок цены в тысячи раз при`);
  log(`копеечной ликвидности — почти всегда смена пула или сбой источника, а не`);
  log(`движение, на котором можно было заработать.`);
  log();
  for (const { e, r } of scored) {
    const entry = e.series[e.i] as Snap;
    log(`- **${pct(r, 0)}** · ${entry.chain} · цена входа $${entry.priceUsd.toPrecision(3)} · ` +
        `ликв $${Math.round(entry.liquidityUsd ?? 0).toLocaleString("ru")} · ` +
        `Δ1ч ${entry.priceChange1h ?? "—"}% · Δ24ч ${entry.priceChange24h ?? "—"}% · ` +
        `сделок 1ч ${(entry.buys1h ?? 0) + (entry.sells1h ?? 0)}`);
  }
  log();
}
// ---------- 4e. Контрольные группы ----------
// Всё, что выше, отвечает на вопрос «сколько заработала эта комбинация».
// Оно НЕ отвечает на главный: а комбинация ли это заработала? Плюс в 20%
// может означать три разные вещи, и различить их можно только контролем:
//   1) фильтр по ликвидности действительно отбирает лучшие токены;
//   2) плюс даёт правило выхода на ЛЮБОМ токене — тогда отбор ни при чём;
//   3) плюс возникает потому, что мы покупаем в момент ПЕРВОГО наблюдения,
//      а первая увиденная цена систематически ниже последующих (артефакт
//      измерения, а не рынок) — тогда торговать этим нельзя вообще.
// Ниже по одному контролю на каждую версию.
{
  log(`### 4e. Контрольные группы: это отбор или артефакт измерения`);
  log();
  log(`Положительное среднее выше само по себе ничего не доказывает. Ровно та же`);
  log(`процедура запускается здесь с изменённым ОДНИМ условием: если результат не`);
  log(`меняется, значит найденное правило ни при чём.`);
  log();

  const noFilter = collectExitEntries({ minLiquidityUsd: 0 });
  log(`**Контроль 1 — без фильтра по ликвидности.** Те же выходы, вход в любой`);
  log(`токен (${noFilter.entries.length} сделок из ${noFilter.candidates} входов).`);
  log(`Если среднее такое же — фильтр ликвидности не отбирает ничего, и «стратегия»`);
  log(`сводится к правилу выхода.`);
  log();
  logPolicyTable(noFilter.entries, true);

  const delayed = collectExitEntries({ minLiquidityUsd: 50_000, delayMin: 60 });
  log(`**Контроль 2 — тот же отбор, вход на час позже.** Токены отбираются точно`);
  log(`так же, но покупка происходит через 60 минут после подходящего наблюдения`);
  log(`(${delayed.entries.length} сделок из ${delayed.candidates} входов).`);
  log(`Это проверка на артефакт первой цены: если весь плюс исчезает от часовой`);
  log(`задержки, значит мы измеряли не рынок, а то, что первая увиденная цена`);
  log(`систематически занижена. Торговать этим нельзя — эта «прибыль» существует`);
  log(`только в базе данных.`);
  log();
  logPolicyTable(delayed.entries, true);

  log(`Вывод по контролям делается так: кандидат считается живым, только если его`);
  log(`среднее ЗАМЕТНО выше контроля 1 и ВЫЖИВАЕТ в контроле 2. Совпадение с`);
  log(`контролем 1 означает, что отбор бесполезен; провал контроля 2 означает, что`);
  log(`результата нет вовсе.`);
  log();

  // Контроль 1 сравнивает «> $50k» со «всем подряд», и у этого сравнения есть
  // изъян: в мелких пулах $50 позиции сами по себе стоят дороже (проскальзывание
  // растёт), поэтому часть разницы — не качество токенов, а цена исполнения.
  // Порог $50k к тому же выбран нами, а любой выбранный порог легко подогнать.
  // Честная проверка — доза-эффект: если результат растёт С РОСТОМ ликвидности
  // плавно, это похоже на настоящую зависимость. Если он плоский везде и
  // подскакивает ровно на нашем пороге — мы подобрали число под данные.
  {
    const BUCKETS: { name: string; min: number; max?: number }[] = [
      { name: "до $10k", min: 0, max: 10_000 },
      { name: "$10k – $50k", min: 10_000, max: 50_000 },
      { name: "$50k – $200k", min: 50_000, max: 200_000 },
      { name: "$200k – $1M", min: 200_000, max: 1_000_000 },
      { name: "больше $1M", min: 1_000_000 },
    ];
    const shown = EXITS.filter((e) =>
      e.name === "фикс. выход через 24ч" || e.name === "стоп −20% + трейлинг 30%, до 3д");
    log(`**Доза-эффект по ликвидности.** Порог $50k выбран нами, поэтому проверяем`);
    log(`не «выше/ниже порога», а всю шкалу. Плавный рост — признак настоящей`);
    log(`зависимости; скачок ровно на нашем пороге — признак подгонки.`);
    log();
    log(`| Ликвидность на входе | Сделок | ${shown.map((e) => `${e.name}: среднее`).join(" | ")} | Прибыльных |`);
    log(`|---|---|${shown.map(() => "---|").join("")}---|`);
    for (const b of BUCKETS) {
      const set = collectExitEntries({ minLiquidityUsd: b.min, maxLiquidityUsd: b.max });
      const cells = shown.map((e) => {
        const rs = policyReturns(set.entries, e);
        return rs.length >= 20 ? `**${pct(mean(rs))}**` : `n=${rs.length}`;
      });
      const ref = policyReturns(set.entries, shown[0] as NamedExit);
      log(`| ${b.name} | ${ref.length} | ${cells.join(" | ")} | ${ref.length >= 20 ? pct(winRate(ref), 0) : "—"} |`);
    }
    log();
  }

  // Контроль 2 показал, что часовая задержка съедает примерно половину
  // результата. У этого два несовместимых объяснения, и различить их можно
  // только формой кривой:
  //   * ЦЕНА УСТАРЕЛА — первое наблюдение показывает цену, которой уже нет.
  //     Тогда потеря происходит СРАЗУ, за первые минуты, и торговать нечем:
  //     купить по этой цене было невозможно уже в момент, когда мы её увидели.
  //   * МОМЕНТУМ — рост действительно продолжается после нашего наблюдения.
  //     Тогда результат убывает ПЛАВНО, и вопрос только в скорости исполнения.
  {
    const DELAYS = [0, 5, 15, 30, 60, 120];
    const shown = EXITS.filter((e) =>
      e.name === "фикс. выход через 24ч" || e.name === "стоп −20% + трейлинг 30%, до 3д");
    log(`**Кривая затухания по задержке входа.** Тот же отбор, покупка через N`);
    log(`минут после подходящего наблюдения. Обрыв между 0 и 5 минутами означает,`);
    log(`что первая цена нежизнеспособна (купить по ней было нельзя). Плавное`);
    log(`затухание означает, что эффект реален, а вопрос — в скорости исполнения.`);
    log();
    log(`| Задержка входа | Сделок | ${shown.map((e) => `${e.name}: среднее`).join(" | ")} |`);
    log(`|---|---|${shown.map(() => "---|").join("")}`);
    for (const d of DELAYS) {
      const set = collectExitEntries({ minLiquidityUsd: 50_000, delayMin: d || undefined });
      const cells = shown.map((e) => {
        const rs = policyReturns(set.entries, e);
        return rs.length >= 20 ? `**${pct(mean(rs))}**` : `n=${rs.length}`;
      });
      const ref = policyReturns(set.entries, shown[0] as NamedExit);
      log(`| ${d} мин | ${ref.length} | ${cells.join(" | ")} |`);
    }
    log();
  }
}

// ---------- 4f. Проверка после заморозки ----------
// Единственный раздел отчёта, который имеет право что-то доказывать. Всё
// остальное посчитано на данных, по которым правила и подбирались, а такой
// результат положителен почти всегда — достаточно перебрать достаточно
// вариантов. Здесь считаются ТОЛЬКО сделки, начавшиеся после момента
// заморозки правил, и критерии зафиксированы заранее в
// docs/PREREGISTRATION.md, чтобы вердикт нельзя было подогнать по факту.
{
  log(`## 4f. Проверка после заморозки правил (${FREEZE_AT.toISOString()})`);
  log();
  log(`Правила заморожены и описаны в \`docs/PREREGISTRATION.md\`. Считаются только`);
  log(`сделки, вход в которые состоялся ПОСЛЕ этого момента: всё, что раньше, —`);
  log(`данные, на которых правила подбирались, и доказательством быть не может.`);
  log();

  const afterFreeze = (e: ExitEntry) =>
    (e.series[e.i] as Snap).fetchedAt.getTime() >= FREEZE_AT.getTime();
  const testEntries = entriesForExit.filter(afterFreeze);
  const controlEntries = collectExitEntries({ minLiquidityUsd: 0 }).entries.filter(afterFreeze);

  const rs = policyReturns(testEntries, { name: FROZEN_POLICY.name, run: (s, i) => simulateExit(s, i, FROZEN_POLICY) });
  const control = policyReturns(controlEntries, { name: "контроль", run: (s, i) => simulateExit(s, i, FROZEN_POLICY) });

  const MIN_TRADES = 100;
  const m = mean(rs);
  const ci = bootstrapMeanCI(rs);
  const sorted = [...rs].sort((a, b) => b - a);
  const withoutBest = rs.length > 1 ? mean(sorted.slice(1)) : null;
  const controlMean = mean(control);

  const days = Math.max(0, (Date.now() - FREEZE_AT.getTime()) / 86_400_000);
  log(`Прошло с заморозки: **${days.toFixed(1)} сут**. Сделок с измеримым исходом: **${rs.length}**.`);
  log();

  // Вердикт выносится только когда для него есть основания. Пока выборка не
  // набрана и дедлайн не наступил, раздел обязан показывать «проверка идёт»:
  // напечатать «NO EDGE» на нулевой выборке — это выдать отсутствие данных за
  // отрицательный результат, что так же нечестно, как выдать шум за прибыль.
  const DEADLINE = new Date("2026-08-15T00:00:00Z");
  const deadlineReached = Date.now() >= DEADLINE.getTime();
  const enough = rs.length >= MIN_TRADES;
  const decidable = enough || deadlineReached;

  const checks: { name: string; ok: boolean | null; detail: string }[] = [
    { name: `Объём ≥ ${MIN_TRADES} сделок`, ok: enough ? true : deadlineReached ? false : null, detail: `${rs.length}` },
    { name: "Среднее > 0", ok: m == null ? null : m > 0, detail: pct(m) },
    { name: "Нижняя граница 95% интервала > 0", ok: ci == null ? null : ci[0] > 0, detail: ci ? `${pct(ci[0], 0)} … ${pct(ci[1], 0)}` : "—" },
    { name: "Среднее без лучшей сделки > 0", ok: withoutBest == null ? null : withoutBest > 0, detail: pct(withoutBest) },
    { name: "Выше контроля «вход в любой токен»", ok: m == null || controlMean == null ? null : m > controlMean, detail: `${pct(m)} против ${pct(controlMean)} (n=${control.length})` },
  ];

  log(`| Критерий (зафиксирован заранее) | Значение | ${decidable ? "Итог" : "Пока"} |`);
  log(`|---|---|---|`);
  for (const c of checks)
    log(`| ${c.name} | ${c.detail} | ${c.ok == null ? "нет данных" : c.ok ? "✅ пройден" : "❌ не пройден"} |`);
  log();

  const failed = checks.filter((c) => c.ok === false);
  if (!decidable) {
    log(`**Проверка идёт, вердикта пока нет.** Набрано ${rs.length} сделок из ${MIN_TRADES};`);
    log(`дедлайн — ${DEADLINE.toISOString().slice(0, 10)}. Цифры выше промежуточные: на малой`);
    log(`выборке они скачут, и читать их как результат нельзя ни в плюс, ни в минус.`);
  } else if (!failed.length) {
    log(`**Все критерии пройдены.** Кандидат подтверждён на одном out-of-sample`);
    log(`окне. Это НЕ значит «стратегия найдена» и не является основанием включать`);
    log(`реальные деньги — это основание продолжать проверку.`);
  } else {
    log(`**NO EDGE.** Не пройдено критериев: ${failed.length} (${failed.map((c) => c.name).join("; ")}).`);
    log(`По заранее записанному правилу это отрицательный вердикт, а не повод`);
    log(`«добрать данных» или ослабить критерий.`);
  }
  log();

  // Обязательная проверка на мусор, обещанная в docs/PREREGISTRATION.md: если
  // результат держится на скачках, похожих на смену пула или сбой источника,
  // вердикт отрицательный независимо от цифр. Раньше такой разбор печатался
  // только для in-sample выборки — то есть ровно там, где он уже ничего не
  // решает. Проверять надо ту выборку, по которой выносится вердикт.
  //
  // Повод конкретный: 9 августа среднее подскочило до +219% при среднем без
  // лучшей сделки −3.5%, то есть одна сделка дала около +7000%. Такое число
  // сначала проверяют, а не празднуют.
  {
    const scored = testEntries
      .map((e) => ({ e, r: simulateExit(e.series, e.i, FROZEN_POLICY) }))
      .filter((x): x is { e: ExitEntry; r: number } => x.r != null)
      .sort((a, b) => b.r - a.r)
      .slice(0, 5);
    if (scored.length) {
      log(`### Пять лучших сделок проверочной выборки`);
      log();
      log(`Рост в десятки раз при копеечной ликвидности или Δ24ч в тысячи`);
      log(`процентов — почти всегда смена пула или сбой источника, а не движение,`);
      log(`на котором можно было заработать.`);
      log();
      for (const { e, r } of scored) {
        const entry = e.series[e.i] as Snap;
        const exitIdx = e.series.length - 1;
        const held = ((e.series[exitIdx] as Snap).fetchedAt.getTime() - entry.fetchedAt.getTime()) / 3600_000;
        log(`- **${pct(r, 0)}** · ${entry.chain} · вход $${entry.priceUsd.toPrecision(3)} · ` +
            `ликв $${Math.round(entry.liquidityUsd ?? 0).toLocaleString("ru")} · ` +
            `Δ1ч ${entry.priceChange1h ?? "—"}% · Δ24ч ${entry.priceChange24h ?? "—"}% · ` +
            `сделок 1ч ${(entry.buys1h ?? 0) + (entry.sells1h ?? 0)} · ` +
            `наблюдений после входа ${e.series.length - e.i - 1} за ${held.toFixed(1)} ч`);
      }
      log();

      // Ценовой путь лучшей сделки — то единственное, что отличает настоящий
      // рост от артефакта. Настоящий: цена растёт через несколько наблюдений,
      // ликвидность растёт вместе с ней, сделок много. Артефакт: скачок между
      // двумя соседними замерами при неизменной ликвидности — так выглядит
      // смена пула или сбой источника, а не движение, на котором можно
      // заработать. Числа не правятся; печатается то, что есть.
      const top = scored[0];
      if (top) {
        const s = top.e.series;
        const from = top.e.i;
        log(`**Ценовой путь лучшей сделки** (${(s[from] as Snap).chain}, вход помечен →):`);
        log();
        log(`| Время | Цена | Ликвидность | Сделок 1ч | Пул |`);
        log(`|---|---|---|---|---|`);
        const step = Math.max(1, Math.ceil((s.length - from) / 12));
        for (let j = from; j < s.length; j += step) {
          const p = s[j] as Snap;
          const pair = await pairAddressAt(p.tokenId, p.fetchedAt);
          log(`| ${j === from ? "→ " : ""}${p.fetchedAt.toISOString().slice(11, 16)} | ` +
              `$${p.priceUsd.toPrecision(4)} | ` +
              `$${p.liquidityUsd == null ? "—" : Math.round(p.liquidityUsd).toLocaleString("ru")} | ` +
              `${(p.buys1h ?? 0) + (p.sells1h ?? 0)} | ` +
              `${pair ? `…${pair.slice(-6)}` : "—"} |`);
        }
        log();
        log(`Колонка «Пул» решает вопрос. Источник отдаёт по токену ЛУЧШУЮ пару, и`);
        log(`когда ликвидность переезжает в другой пул, котировка скачком переходит`);
        log(`на его цену. В отчёте это выглядит ростом в десятки раз, но заработать`);
        log(`на нём было нельзя: нашей позиции в новом пуле нет. Сменился адрес —`);
        log(`сделка недостоверна, как бы красиво ни выглядело среднее`);
        log(`(правило из \`docs/PREREGISTRATION.md\`).`);
        log();
      }

      // То же самое, но по ВСЕЙ проверочной выборке: одна подозрительная сделка
      // — случай, а систематическая смена пулов означает, что весь правый хвост
      // исследования измеряет переезды ликвидности, а не заработок.
      {
        let changed = 0, known = 0;
        for (const { e } of testEntries.map((e) => ({ e }))) {
          const entry = e.series[e.i] as Snap;
          const last = e.series[e.series.length - 1] as Snap;
          const a = await pairAddressAt(entry.tokenId, entry.fetchedAt);
          const b = await pairAddressAt(last.tokenId, last.fetchedAt);
          if (!a || !b) continue;
          known++;
          if (a !== b) changed++;
        }
        log(`**Смена пула за время удержания:** ${changed} из ${known} сделок, у которых`);
        log(`адрес пары известен на обоих концах. Если доля заметная, правый хвост`);
        log(`измеряет переезды ликвидности между пулами, а не доходность стратегии.`);
        log();
      }

      // Частота наблюдений — угроза, которую видно только после разбора пути.
      //
      // Трейлинг-стоп срабатывает от ПРОСАДКИ, а просадку можно увидеть лишь в
      // тот момент, когда мы смотрим на цену. Лучшая сделка выборки прожила
      // почти восемь часов на девяти наблюдениях — раз в 51 минуту. Между
      // замерами цена могла падать на 30% и возвращаться сколько угодно раз:
      // стоп бы сработал в жизни и не сработал в модели.
      //
      // Ошибка асимметрична: редкие замеры НЕ мешают сделке вырасти, но мешают
      // её закрыть. То есть она завышает ровно те хвостовые сделки, на которых
      // держится всё среднее. Проверяется просто — сравнением по плотности
      // наблюдений. Если прибыль живёт только в редко опрошенных сделках, это
      // не стратегия, а частота опроса.
      {
        const buckets: { name: string; min: number; max: number; rs: number[] }[] = [
          { name: "реже 1 раза в час", min: 0, max: 1, rs: [] },
          { name: "1–10 раз в час", min: 1, max: 10, rs: [] },
          { name: "чаще 10 раз в час", min: 10, max: Infinity, rs: [] },
        ];
        for (const e of testEntries) {
          const r = simulateExit(e.series, e.i, FROZEN_POLICY);
          if (r == null) continue;
          const entry = e.series[e.i] as Snap;
          const last = e.series[e.series.length - 1] as Snap;
          const hours = (last.fetchedAt.getTime() - entry.fetchedAt.getTime()) / 3600_000;
          if (hours <= 0) continue;
          const perHour = (e.series.length - e.i - 1) / hours;
          const b = buckets.find((x) => perHour >= x.min && perHour < x.max);
          b?.rs.push(r);
        }
        log(`**Результат в зависимости от частоты наблюдений.** Трейлинг-стоп ловит`);
        log(`просадку только в момент замера: чем реже смотрим, тем меньше шансов`);
        log(`закрыться и тем выше выглядит доходность. Ошибка односторонняя, поэтому`);
        log(`сравнение обязательно.`);
        log();
        // Колонка «без лучшей» здесь не украшение, а суть проверки. Разрыв
        // между группами может создавать одна-единственная сделка, и тогда он
        // говорит не о частоте опроса, а всё о той же одной сделке. Без этой
        // колонки разницу приходится считать руками по двум таблицам — и
        // ошибиться в пользу красивой гипотезы.
        const dropBest = (xs: number[]): number | null =>
          xs.length > 1 ? mean([...xs].sort((a, b) => b - a).slice(1)) : null;
        log(`| Частота наблюдений | Сделок | Среднее | Без лучшей сделки | Медиана |`);
        log(`|---|---|---|---|---|`);
        for (const b of buckets)
          log(`| ${b.name} | ${b.rs.length} | ${b.rs.length ? pct(mean(b.rs)) : "—"} | ` +
              `${b.rs.length ? pct(dropBest(b.rs)) : "—"} | ${b.rs.length ? pct(median(b.rs)) : "—"} |`);
        log();
        log(`Если прибыль сосредоточена в редко опрошенных сделках — измеряется`);
        log(`частота опроса, а не стратегия, и результат недействителен. Но сравнивать`);
        log(`надо колонку «без лучшей сделки»: если группы сходятся, как только`);
        log(`убрана одна сделка, дело не в частоте опроса, а в этой сделке.`);
        log();

        // Сравнение групп между собой не решает вопрос, и вот почему: сканер
        // опрашивает чаще те токены, которые сам счёл интересными. Значит
        // «часто опрошенные» — это ещё и другой отбор, а не только другая
        // частота. Разницу между группами можно объяснить и тем, и другим.
        //
        // Чистый ответ даёт сравнение сделки САМОЙ С СОБОЙ. Берём те же самые
        // сделки и прореживаем их историю после входа, оставляя каждое
        // десятое наблюдение. Отбор при этом не меняется вообще — меняется
        // только то, как часто мы смотрим на цену. Если прореживание само по
        // себе поднимает доходность, ошибка механическая и доказана.
        {
          const thin = (series: Snap[], i: number, keepEvery: number): Snap[] => {
            const head = series.slice(0, i + 1);
            const tail = series.slice(i + 1).filter((_, k) => k % keepEvery === 0);
            return [...head, ...tail];
          };
          const full: number[] = [], thinned: number[] = [];
          for (const e of testEntries) {
            const a = simulateExit(e.series, e.i, FROZEN_POLICY);
            const b = simulateExit(thin(e.series, e.i, 10), e.i, FROZEN_POLICY);
            if (a == null || b == null) continue;
            full.push(a);
            thinned.push(b);
          }
          log(`**Та же выборка, прореженная в 10 раз.** Сделки те же самые, отбор тот`);
          log(`же самый — меняется только частота наблюдений после входа. Это`);
          log(`сравнение свободно от возражения «сканер чаще смотрит на другие токены».`);
          log();
          log(`| Как считаем | Сделок | Среднее | Без лучшей сделки | Медиана |`);
          log(`|---|---|---|---|---|`);
          log(`| все наблюдения | ${full.length} | ${pct(mean(full))} | ${pct(dropBest(full))} | ${pct(median(full))} |`);
          log(`| каждое 10-е | ${thinned.length} | ${pct(mean(thinned))} | ${pct(dropBest(thinned))} | ${pct(median(thinned))} |`);
          log();
          log(`Если прореженная строка заметно выше — редкие наблюдения сами по себе`);
          log(`завышают результат, и всё исследование, построенное на трейлинг-стопе,`);
          log(`измеряет частоту опроса. Если строки совпадают — эффекта нет, и`);
          log(`разницу между группами выше создаёт отбор токенов, а не измерение.`);
          log();
        }
      }
    }
  }
}

log(`Если среднее у какой-то политики устойчиво положительное при достаточном`);
log(`числе сделок — это первый настоящий кандидат в стратегию. Если все`);
log(`отрицательные, значит дело не в выходе, и вход отбирает мусор.`);
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
