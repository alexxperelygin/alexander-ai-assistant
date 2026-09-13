// Проверка ФИЛЬТРА РИСКА по docs/PREREGISTRATION_RISKFILTER.md
// (запускается НА сервере): npx tsx deploy/riskfilter.mts
//
// Критерии заморожены до первого расчёта. Здесь они только вычисляются —
// менять их, увидев результат, нельзя.
import { prisma } from "../src/lib/db";
import { simulateFill } from "../src/lib/paper/execution";

/** Размер условной позиции: тот же, что в треках, чтобы издержки совпадали. */
const POSITION_USD = 50;
const HORIZONS: [string, number][] = [["6h", 360], ["24h", 1440]];
/** Ругпулл: ликвидность упала ниже пятой части от той, что была при вердикте. */
const RUG_FRACTION = 0.2;
// SQLite ограничивает число параметров в запросе. Prisma умеет резать
// длинный `in` на части — но ТОЛЬКО если в том же запросе нет отрицания:
// `priceUsd: { not: null }` эту разбивку запрещает, и запрос падает с P2029.
// Поэтому пустые цены отсеиваются в коде, а батч взят с запасом.
const TOKEN_BATCH = 500;

interface Verdict { tokenId: string; at: number; avoid: boolean; status: string }
interface Outcome {
  avoid: boolean;
  status: string;
  at: number;
  ret: Record<string, number | null>;
  rugged: boolean | null;
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return NaN;
  const i = (sorted.length - 1) * q;
  const lo = Math.floor(i), hi = Math.ceil(i);
  return lo === hi ? (sorted[lo] as number) : (sorted[lo] as number) * (hi - i) + (sorted[hi] as number) * (i - lo);
}
const median = (xs: number[]) => quantile([...xs].sort((a, b) => a - b), 0.5);

/** Детерминированный генератор: отчёт должен воспроизводиться. */
function makeRnd(seed: number) {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
}

/**
 * Бутстрап-интервал РАЗНИЦЫ МЕДИАН двух независимых выборок.
 * Разница медиан, а не средних: на хвостовом распределении среднее двигает
 * один выброс, и «различие» оказалось бы свойством одной строки.
 */
function bootstrapMedianDiffCI(a: number[], b: number[], iters = 2000): [number, number] | null {
  if (a.length < 20 || b.length < 20) return null;
  const rnd = makeRnd(20260913);
  const diffs: number[] = [];
  for (let k = 0; k < iters; k++) {
    const sa: number[] = [], sb: number[] = [];
    for (let j = 0; j < a.length; j++) sa.push(a[Math.floor(rnd() * a.length)] as number);
    for (let j = 0; j < b.length; j++) sb.push(b[Math.floor(rnd() * b.length)] as number);
    diffs.push(median(sa) - median(sb));
  }
  diffs.sort((x, y) => x - y);
  return [quantile(diffs, 0.025), quantile(diffs, 0.975)];
}

/** Бутстрап-интервал ОТНОШЕНИЯ двух долей (частот ругпуллов). */
function bootstrapRatioCI(aHits: number, aN: number, bHits: number, bN: number, iters = 2000): [number, number] | null {
  if (aN < 20 || bN < 20 || bHits === 0) return null;
  const rnd = makeRnd(913202609);
  const draw = (hits: number, n: number) => {
    let c = 0;
    const p = hits / n;
    for (let j = 0; j < n; j++) if (rnd() < p) c += 1;
    return c / n;
  };
  const rs: number[] = [];
  for (let k = 0; k < iters; k++) {
    const pb = draw(bHits, bN);
    rs.push(pb === 0 ? NaN : draw(aHits, aN) / pb);
  }
  const clean = rs.filter((x) => Number.isFinite(x)).sort((x, y) => x - y);
  if (clean.length < iters / 2) return null;
  return [quantile(clean, 0.025), quantile(clean, 0.975)];
}

// ── Первый вердикт по каждому токену ────────────────────────────────────────
// Берётся ПЕРВЫЙ вердикт, каким бы он ни был: если брать AVOID в момент его
// срабатывания, а остальных при первой встрече, моменты замера окажутся
// разного сорта и разница выйдет из-за времени, а не из-за качества токена.
const opps = await prisma.opportunity.findMany({ select: { id: true, tokenId: true } });
const oppToken = new Map(opps.map((o) => [o.id, o.tokenId]));

const firstByToken = new Map<string, { at: number; status: string }>();
const EV_BATCH = 50_000;
let cursor: string | undefined;
for (;;) {
  const evs = await prisma.signalEvent.findMany({
    take: EV_BATCH,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    orderBy: { id: "asc" },
    select: { id: true, opportunityId: true, createdAt: true, toStatus: true },
  });
  if (evs.length === 0) break;
  for (const e of evs) {
    const tid = oppToken.get(e.opportunityId);
    if (!tid) continue;
    const at = e.createdAt.getTime();
    const prev = firstByToken.get(tid);
    if (!prev || at < prev.at) firstByToken.set(tid, { at, status: e.toStatus });
  }
  cursor = evs[evs.length - 1]?.id;
  if (evs.length < EV_BATCH) break;
}

// По времени: батчи должны быть локальными по времени, иначе окно выборки
// снимков растягивается на весь период и тянет лишнее.
const verdicts: Verdict[] = [...firstByToken.entries()]
  .map(([tokenId, v]) => ({ tokenId, at: v.at, avoid: v.status === "AVOID", status: v.status }))
  .sort((a, b) => a.at - b.at);

// ── Исходы вперёд от вердикта ───────────────────────────────────────────────
const outcomes: Outcome[] = [];
for (let i = 0; i < verdicts.length; i += TOKEN_BATCH) {
  const batch = verdicts.slice(i, i + TOKEN_BATCH);
  const ids = batch.map((v) => v.tokenId);
  const minAt = new Date(Math.min(...batch.map((v) => v.at)) - 3600_000);
  const maxAt = new Date(Math.max(...batch.map((v) => v.at)) + 24 * 3600_000);
  const snaps = await prisma.tokenSnapshot.findMany({
    where: { tokenId: { in: ids }, fetchedAt: { gte: minAt, lte: maxAt } },
    select: { tokenId: true, fetchedAt: true, priceUsd: true, liquidityUsd: true },
    orderBy: { fetchedAt: "asc" },
  });
  const byToken = new Map<string, { at: number; price: number; liq: number | null }[]>();
  for (const s of snaps) {
    if (s.priceUsd == null) continue;
    const arr = byToken.get(s.tokenId) ?? [];
    arr.push({ at: s.fetchedAt.getTime(), price: s.priceUsd, liq: s.liquidityUsd });
    byToken.set(s.tokenId, arr);
  }
  for (const v of batch) {
    const series = byToken.get(v.tokenId);
    if (!series || series.length === 0) continue;
    // Цена входа — последнее наблюдение НЕ ПОЗЖЕ вердикта. Брать более позднее
    // значило бы знать будущее в момент решения.
    const before = series.filter((p) => p.at <= v.at);
    const entry = before[before.length - 1];
    if (!entry || !(entry.price > 0)) continue;
    const after = series.filter((p) => p.at > v.at);
    const entryFill = simulateFill({
      sideUsd: POSITION_USD, priceUsd: entry.price, liquidityUsd: entry.liq, direction: "buy",
    });
    const ret: Record<string, number | null> = {};
    let rugged: boolean | null = null;
    for (const [key, minutes] of HORIZONS) {
      const deadline = v.at + minutes * 60_000;
      const cands = after.filter((p) => p.at <= deadline);
      const exit = cands[cands.length - 1];
      // Наблюдение должно быть во ВТОРОЙ половине окна: иначе снимок через
      // пять минут выдавал бы себя за исход шести часов.
      if (!exit || exit.at < v.at + (minutes * 60_000) / 2) { ret[key] = null; continue; }
      if (key === "6h" && exit.liq != null && entry.liq != null && entry.liq > 0) {
        rugged = exit.liq < entry.liq * RUG_FRACTION;
      }
      const exitFill = simulateFill({
        sideUsd: POSITION_USD * (exit.price / entry.price),
        priceUsd: exit.price, liquidityUsd: exit.liq, direction: "sell",
      });
      if (!entryFill.executed || !exitFill.executed) { ret[key] = null; continue; }
      ret[key] = (entryFill.quantity * exitFill.effectivePriceUsd - exitFill.feesUsd) / POSITION_USD - 1;
    }
    outcomes.push({ avoid: v.avoid, status: v.status, at: v.at, ret, rugged });
  }
}

// ── Отчёт ───────────────────────────────────────────────────────────────────
const L: string[] = [];
const pp = (x: number) => `${x >= 0 ? "+" : ""}${(x * 100).toFixed(1)}%`;
const ok = (b: boolean) => (b ? "✅" : "❌");

L.push(`# Фильтр риска: проверка по замороженным критериям (${new Date().toISOString()})`);
L.push("");
L.push("Критерии заморожены в `docs/PREREGISTRATION_RISKFILTER.md` ДО первого расчёта.");
L.push("");

/** Значения критериев, посчитанные на одном срезе. */
interface Checks { c1: boolean; c2: boolean; c3: boolean; c4: boolean; c6: boolean }

function block(title: string, set: Outcome[], horizon: string): Checks | null {
  L.push(`## ${title}`);
  const av = set.filter((o) => o.avoid);
  const nv = set.filter((o) => !o.avoid);
  const avR = av.map((o) => o.ret[horizon]).filter((x): x is number => x != null);
  const nvR = nv.map((o) => o.ret[horizon]).filter((x): x is number => x != null);
  L.push("");
  L.push(`| | AVOID | не-AVOID |`);
  L.push(`|---|---|---|`);
  L.push(`| вердиктов всего | ${av.length} | ${nv.length} |`);
  L.push(`| измеримых на ${horizon} | ${avR.length} | ${nvR.length} |`);
  L.push(`| доля неизмеримых | ${av.length ? ((1 - avR.length / av.length) * 100).toFixed(1) : "—"}% | ${nv.length ? ((1 - nvR.length / nv.length) * 100).toFixed(1) : "—"}% |`);
  if (avR.length === 0 || nvR.length === 0) {
    L.push("");
    L.push("Данных для сравнения нет.");
    L.push("");
    return null;
  }
  const avMed = median(avR), nvMed = median(nvR);
  L.push(`| медиана доходности | ${pp(avMed)} | ${pp(nvMed)} |`);
  const avRug = av.filter((o) => o.rugged != null);
  const nvRug = nv.filter((o) => o.rugged != null);
  const avRugHits = avRug.filter((o) => o.rugged).length;
  const nvRugHits = nvRug.filter((o) => o.rugged).length;
  const avRugPct = avRug.length ? avRugHits / avRug.length : NaN;
  const nvRugPct = nvRug.length ? nvRugHits / nvRug.length : NaN;
  L.push(`| ругпуллов (измеримо) | ${(avRugPct * 100).toFixed(1)}% из ${avRug.length} | ${(nvRugPct * 100).toFixed(1)}% из ${nvRug.length} |`);
  L.push("");

  const gap = nvMed - avMed; // насколько AVOID ХУЖЕ, в долях
  const diffCI = bootstrapMedianDiffCI(avR, nvR);
  const ratio = nvRugPct > 0 ? avRugPct / nvRugPct : NaN;
  const ratioCI = bootstrapRatioCI(avRugHits, avRug.length, nvRugHits, nvRug.length);
  const unmeasGap = Math.abs(
    (av.length ? 1 - avR.length / av.length : 0) - (nv.length ? 1 - nvR.length / nv.length : 0),
  );

  const c1 = avR.length >= 500 && nvR.length >= 500;
  const c2 = gap >= 0.20;
  const c3 = diffCI != null && diffCI[1] < 0;
  const c4 = Number.isFinite(ratio) && ratio >= 1.5 && ratioCI != null && ratioCI[0] > 1;
  const c6 = unmeasGap < 0.15;

  L.push(`* ${ok(c1)} **≥500 измеримых в каждой группе**: ${avR.length} и ${nvR.length}`);
  L.push(`* ${ok(c2)} **разрыв медиан ≥20 п.п.**: AVOID хуже на ${(gap * 100).toFixed(1)} п.п.`);
  L.push(`* ${ok(c3)} **интервал разницы медиан без нуля**: ${diffCI ? `[${pp(diffCI[0])}, ${pp(diffCI[1])}]` : "не считается (мало данных)"}`);
  L.push(`* ${ok(c4)} **ругпуллы чаще в ≥1.5 раза**: отношение ${Number.isFinite(ratio) ? ratio.toFixed(2) : "—"}×, интервал ${ratioCI ? `[${ratioCI[0].toFixed(2)}, ${ratioCI[1].toFixed(2)}]` : "не считается"}`);
  L.push(`* ${ok(c6)} **разрыв долей неизмеримых <15 п.п.**: ${(unmeasGap * 100).toFixed(1)} п.п.`);
  L.push("");
  return { c1, c2, c3, c4, c6 };
}

const full = block("Весь период, горизонт 6ч", outcomes, "6h");
block("Весь период, горизонт 24ч", outcomes, "24h");

const times = outcomes.map((o) => o.at).sort((a, b) => a - b);
const mid = times[Math.floor(times.length / 2)] ?? 0;
const halfSet = outcomes.filter((o) => o.at >= mid);
const half = block("Вторая половина периода, горизонт 6ч (критерий 5)", halfSet, "6h");
// Критерий 5 — повторение критериев 2–4 на второй половине. Требование к
// размеру выборки (c1) к половине периода не применяется: оно заморожено
// для полного периода, и предъявлять его дважды значило бы ужесточить
// критерий задним числом.
const c5 = half != null && half.c2 && half.c3 && half.c4;
L.push(`* ${ok(c5)} **критерий 5: критерии 2–4 повторяются на второй половине периода**`);
L.push("");

// ── Из чего состоят группы ──────────────────────────────────────────────────
// РАЗДЕЛ ОПИСАТЕЛЬНЫЙ. Вердикт выше посчитан по замороженным критериям и от
// этих чисел не зависит — пересматривать его, увидев состав, нельзя.
//
// Зачем он нужен: если контрольная группа состоит в основном из токенов со
// статусом DATA_UNAVAILABLE, то сравнение измеряет не качество фильтра, а
// доступность данных. Догадку надо заменить числом.
{
  L.push("## Из чего состоят группы (описательно, вердикт не меняет)");
  L.push("");
  const byStatus = new Map<string, { n: number; meas: number; med: number[]; rugN: number; rugHits: number }>();
  for (const o of outcomes) {
    const cur = byStatus.get(o.status) ?? { n: 0, meas: 0, med: [], rugN: 0, rugHits: 0 };
    cur.n += 1;
    const r = o.ret["6h"];
    if (r != null) { cur.meas += 1; cur.med.push(r); }
    if (o.rugged != null) { cur.rugN += 1; if (o.rugged) cur.rugHits += 1; }
    byStatus.set(o.status, cur);
  }
  L.push("| статус первого вердикта | наблюдений | измеримых на 6ч | медиана | ругпуллов |");
  L.push("|---|---|---|---|---|");
  for (const [st, v] of [...byStatus.entries()].sort((a, b) => b[1].n - a[1].n)) {
    L.push(
      `| ${st} | ${v.n} | ${v.meas} | ${v.med.length ? pp(median(v.med)) : "—"} | ` +
      `${v.rugN ? ((v.rugHits / v.rugN) * 100).toFixed(1) + "% из " + v.rugN : "—"} |`,
    );
  }
  L.push("");
  const ctrl = outcomes.filter((o) => !o.avoid);
  const du = ctrl.filter((o) => o.status === "DATA_UNAVAILABLE").length;
  L.push(
    `Контрольная группа «не-AVOID»: ${ctrl.length} наблюдений, из них ` +
    `**${du} со статусом DATA_UNAVAILABLE** (${ctrl.length ? ((du / ctrl.length) * 100).toFixed(1) : "—"}%).`,
  );
  L.push("");
  L.push(
    du / Math.max(1, ctrl.length) > 0.5
      ? "⚠️ Контрольная группа состоит преимущественно из токенов, по которым не удалось " +
        "получить данные. Значит тест сравнил «отбракованные» не с нормальными, а с теми, " +
        "кого не удалось разглядеть, — и разница объясняется доступностью данных, а не " +
        "качеством фильтра. Это **ошибка проектирования пре-регистрации**: статус " +
        "DATA_UNAVAILABLE следовало исключить из контроля заранее. Вердикт NO EDGE при " +
        "этом остаётся в силе: критерии заморожены до расчёта, и переигрывать их нельзя. " +
        "Узкий вопрос «AVOID против реально торгуемых» требует НОВОЙ заморозки и нового теста."
      : "Контрольная группа не сводится к токенам без данных.",
  );
  L.push("");
}

// ── Упреждение: предупреждает или сообщает постфактум ───────────────────────
// Пре-регистрация требует публиковать это рядом с критериями. Смысл простой:
// пометка «из пула выводят средства», появившаяся одновременно с обвалом,
// пользователю бесполезна, сколь угодно хорошей ни была бы статистика.
{
  const drains = await prisma.signalEvent.findMany({
    where: { reason: { contains: "liquidity-draining" } },
    select: { opportunityId: true, createdAt: true },
  });
  const points = drains
    .map((d) => ({ tokenId: oppToken.get(d.opportunityId), at: d.createdAt.getTime() }))
    .filter((d): d is { tokenId: string; at: number } => d.tokenId != null)
    .sort((a, b) => a.at - b.at);

  const leadsMin: number[] = [];
  let noHalving = 0;
  let noData = 0;
  for (let i = 0; i < points.length; i += TOKEN_BATCH) {
    const batch = points.slice(i, i + TOKEN_BATCH);
    if (batch.length === 0) break;
    const ids = [...new Set(batch.map((d) => d.tokenId))];
    const minAt = new Date((batch[0] as { at: number }).at - 3600_000);
    const maxAt = new Date((batch[batch.length - 1] as { at: number }).at + 24 * 3600_000);
    const snaps = await prisma.tokenSnapshot.findMany({
      where: { tokenId: { in: ids }, fetchedAt: { gte: minAt, lte: maxAt } },
      select: { tokenId: true, fetchedAt: true, priceUsd: true },
      orderBy: { fetchedAt: "asc" },
    });
    const byToken = new Map<string, { at: number; price: number }[]>();
    for (const sn of snaps) {
      if (sn.priceUsd == null) continue;
      const arr = byToken.get(sn.tokenId) ?? [];
      arr.push({ at: sn.fetchedAt.getTime(), price: sn.priceUsd });
      byToken.set(sn.tokenId, arr);
    }
    for (const d of batch) {
      const series = byToken.get(d.tokenId);
      if (!series) { noData += 1; continue; }
      const before = series.filter((x) => x.at <= d.at);
      const base = before[before.length - 1];
      if (!base || !(base.price > 0)) { noData += 1; continue; }
      const hit = series.find((x) => x.at > d.at && x.price <= base.price * 0.5);
      // Пока цена не упала вдвое — в медиану не идёт: подставить сюда «сутки»
      // значило бы выдать отсутствие наблюдения за наблюдение.
      if (!hit) { noHalving += 1; continue; }
      leadsMin.push((hit.at - d.at) / 60000);
    }
  }

  L.push("## Упреждение: предупреждает или сообщает постфактум");
  L.push("");
  L.push(`Срабатываний \`liquidity-draining\`: ${points.length}.`);
  if (leadsMin.length === 0) {
    L.push("Ни по одному не удалось измерить время до падения цены вдвое.");
  } else {
    const medLead = median(leadsMin);
    L.push(
      `Цена упала вдвое после пометки в ${leadsMin.length} случаях, ` +
      `медиана упреждения **${medLead.toFixed(0)} мин**. ` +
      `Ещё ${noHalving} раз цена вдвое не падала вовсе, ${noData} — нет данных.`,
    );
    L.push("");
    L.push(
      medLead < 15
        ? "❌ **Меньше 15 минут: пометка сообщает об обвале, а не предупреждает о нём.** " +
          "Назвать её полезной для пользователя нельзя, даже если критерии 1–6 выполнены."
        : "✅ Пометка появляется заметно раньше обвала — это упреждение, а не описание.",
    );
  }
  L.push("");
}

L.push("## Вердикт");
L.push("");
const allOk = full != null && full.c1 && full.c2 && full.c3 && full.c4 && full.c6 && c5;
L.push(
  allOk
    ? "Все замороженные критерии выполнены. Это означает ровно одно: пометка AVOID " +
      "статистически связана с худшим исходом на измеренном периоде. Не обещание " +
      "доходности и не основание включать реальную торговлю."
    : "**NO EDGE по фильтру риска.** Выполнены не все замороженные критерии. " +
      "Критерии заморожены до расчёта, поэтому подбирать другой срез, на котором " +
      "получится лучше, нельзя — это и был бы тот самый подгон, ради исключения " +
      "которого писалась пре-регистрация.",
);
L.push("");
L.push(`Наблюдений всего: ${outcomes.length} (по одной точке на токен).`);

console.log(L.join("\n"));
await prisma.$disconnect();
