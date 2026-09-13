// Симуляция СЧЁТА с фиксированным депозитом (запускается НА сервере):
//   cd /opt/alexander-ai-assistant/memescope && npx tsx deploy/equity.mts
//
// Зачем отдельно от backtest. Треки системы счёта не ведут: каждый вход —
// фиксированные $50 независимо от накопленного. Поэтому сумма P&L не
// доходность: реинвестирования нет, просадки нет, нехватки денег нет.
// Здесь тот же поток сделок проигрывается на настоящем счёте: капитал
// ограничен, размер позиции считается от текущего капитала, а сделка, на
// которую денег не хватило, НЕ берётся — и это записывается отдельно.
import { prisma } from "../src/lib/db";
import { FREEZE_AT } from "../src/lib/paper/exit-policy";

const START_USD = 1000;

interface Trade {
  openedAt: number;
  closedAt: number;
  /** Доходность сделки к её стоимости: (P&L / вложено). */
  ret: number;
  rule: string;
  symbol: string;
  /** Выход взят по устаревшей цене — результат допущение, а не измерение. */
  shaky: boolean;
  pnlUsd: number;
}

/** Правило размера позиции. Фиксированная сумма или доля текущего капитала. */
type Sizing = { kind: "fixed"; usd: number } | { kind: "pct"; pct: number };

interface SimResult {
  finalEquity: number;
  taken: number;
  skippedNoCash: number;
  maxDrawdownPct: number;
  worstStreak: number;
  minEquity: number;
}

/**
 * Событийная симуляция. Позиции пересекаются во времени, поэтому нельзя
 * просто перемножить доходности: пока три сделки открыты, деньги на четвёртую
 * могут не найтись. Именно этого ограничения у бумажных треков не было.
 */
function simulate(trades: Trade[], sizing: Sizing): SimResult {
  type Ev = { t: number; kind: "open" | "close"; i: number };
  const evs: Ev[] = [];
  trades.forEach((tr, i) => {
    evs.push({ t: tr.openedAt, kind: "open", i });
    evs.push({ t: tr.closedAt, kind: "close", i });
  });
  // Закрытия раньше открытий в одну и ту же миллисекунду: деньги должны
  // вернуться на счёт прежде, чем их попробуют потратить. Иначе симуляция
  // отказывала бы во входе там, где реальный счёт бы его взял.
  evs.sort((a, b) => a.t - b.t || (a.kind === "close" ? -1 : 1));

  let cash = START_USD;
  const sizeOf = new Map<number, number>();
  let taken = 0;
  let skipped = 0;
  let peak = START_USD;
  let maxDd = 0;
  let minEq = START_USD;
  let streak = 0;
  let worstStreak = 0;

  const equity = () => cash + [...sizeOf.values()].reduce((s, v) => s + v, 0);

  for (const ev of evs) {
    const tr = trades[ev.i];
    if (!tr) continue;
    if (ev.kind === "open") {
      const want = sizing.kind === "fixed" ? sizing.usd : equity() * sizing.pct;
      // Денег не хватило — сделка просто не берётся. Частичный вход не
      // моделируем: на такой ликвидности он меняет и издержки, и исполнение.
      if (want < 1 || cash < want) { skipped += 1; continue; }
      cash -= want;
      sizeOf.set(ev.i, want);
      taken += 1;
    } else {
      const size = sizeOf.get(ev.i);
      if (size == null) continue; // сделку не брали
      sizeOf.delete(ev.i);
      cash += size * (1 + tr.ret);
      if (tr.ret <= 0) { streak += 1; worstStreak = Math.max(worstStreak, streak); }
      else streak = 0;
      const eq = equity();
      peak = Math.max(peak, eq);
      minEq = Math.min(minEq, eq);
      maxDd = Math.max(maxDd, (peak - eq) / peak);
    }
  }
  // Незакрытые на конец периода возвращаем по себестоимости: домысливать их
  // исход нельзя, а бросать деньги в воздухе — искажать итог.
  cash += [...sizeOf.values()].reduce((s, v) => s + v, 0);
  return {
    finalEquity: cash,
    taken,
    skippedNoCash: skipped,
    maxDrawdownPct: maxDd * 100,
    worstStreak,
    minEquity: minEq,
  };
}

const positions = await prisma.position.findMany({
  where: { status: { in: ["CLOSED", "STOPPED"] }, closedAt: { not: null } },
  include: { token: true },
  orderBy: { openedAt: "asc" },
});

const all: Trade[] = positions
  .filter((p) => p.openedAt.getTime() >= FREEZE_AT.getTime() && p.costUsd > 0)
  .map((p) => ({
    openedAt: p.openedAt.getTime(),
    closedAt: p.closedAt!.getTime(),
    ret: p.realizedPnlUsd / p.costUsd,
    rule: p.entryRule ?? "ready-pipeline",
    symbol: p.token.symbol,
    shaky: p.closeReason?.includes("НЕДОСТОВЕРЕН") ?? false,
    pnlUsd: p.realizedPnlUsd,
  }));

const lines: string[] = [];
const pct = (x: number) => `${x >= 0 ? "+" : ""}${x.toFixed(1)}%`;
const usd = (x: number) => `$${x.toFixed(2)}`;

lines.push(`# Счёт с фиксированным депозитом $${START_USD} (${new Date().toISOString()})`);
lines.push("");
lines.push(
  "Тот же поток сделок, что в треках, проигран на настоящем счёте: капитал " +
  "ограничен, размер позиции считается от текущего капитала, сделка без денег " +
  "не берётся. Треки такого ограничения не знают — там каждый вход ровно $50 " +
  "независимо от накопленного, поэтому их сумма P&L не является доходностью.",
);
lines.push("");

const SIZINGS: [string, Sizing][] = [
  ["фикс $50", { kind: "fixed", usd: 50 }],
  ["1% капитала", { kind: "pct", pct: 0.01 }],
  ["2% капитала", { kind: "pct", pct: 0.02 }],
  ["5% капитала", { kind: "pct", pct: 0.05 }],
  ["10% капитала", { kind: "pct", pct: 0.1 }],
];

function section(title: string, trades: Trade[], note?: string) {
  lines.push(`## ${title}`);
  if (note) lines.push(note);
  if (trades.length === 0) {
    lines.push("Сделок нет.");
    lines.push("");
    return;
  }
  const wins = trades.filter((t) => t.ret > 0).length;
  const sorted = [...trades].map((t) => t.ret).sort((a, b) => a - b);
  const mid = sorted.length % 2 ? sorted[(sorted.length - 1) / 2]! : (sorted[sorted.length / 2 - 1]! + sorted[sorted.length / 2]!) / 2;
  lines.push(
    `Сделок ${trades.length}, прибыльных ${wins} (${((wins / trades.length) * 100).toFixed(1)}%), ` +
    `медиана сделки ${pct(mid * 100)}, среднее ${pct((sorted.reduce((s, r) => s + r, 0) / sorted.length) * 100)}.`,
  );
  lines.push("");
  lines.push("| размер позиции | итог счёта | доходность | макс. просадка | сделок взято | пропущено (нет денег) | худшая серия убытков |");
  lines.push("|---|---|---|---|---|---|---|");
  for (const [name, sz] of SIZINGS) {
    const r = simulate(trades, sz);
    lines.push(
      `| ${name} | ${usd(r.finalEquity)} | ${pct(((r.finalEquity - START_USD) / START_USD) * 100)} | ` +
      `${r.maxDrawdownPct.toFixed(1)}% | ${r.taken} | ${r.skippedNoCash} | ${r.worstStreak} |`,
    );
  }
  lines.push("");
}

const measured = all.filter((t) => !t.shaky);
const byPnl = [...all].sort((a, b) => b.pnlUsd - a.pnlUsd);
const top2 = new Set(byPnl.slice(0, 2));

section("Все закрытые сделки обоих исследовательских треков", all);
section(
  "Только измеренные выходы",
  measured,
  "Без сделок, закрытых по устаревшей цене: их результат — допущение, а не измерение.",
);
section(
  "Без двух крупнейших выигрышей",
  all.filter((t) => !top2.has(t)),
  `Убраны ${byPnl.slice(0, 2).map((t) => `${t.symbol} ${usd(t.pnlUsd)}`).join(" и ")}. ` +
  "Вопрос здесь один: остаётся ли результат, если две удачи из тысячи не случились.",
);
section(
  "Проверенное правило (ликвидность > $50k)",
  all.filter((t) => t.rule === "validated-liquidity"),
);
section(
  "Лотерейный трек ($10k–$50k)",
  all.filter((t) => t.rule === "low-liquidity-lottery"),
);

lines.push("## Чего этот тест НЕ показывает");
lines.push("");
lines.push(
  "* **Выборка сделок уже смещена.** Вход брался только при свободном слоте " +
  "(25 и 15 на трек), и лишь за одни сутки по этой причине пропущено 82 " +
  "подходящих токена. Какие сделки попали в поток, а какие нет, решала " +
  "очередь, а не отбор. На другом счёте очередь была бы другой.",
);
lines.push(
  "* **Издержки взяты из модели.** Комиссии и удар по цене считаются по " +
  "глубине пула, а не по факту исполнения. На ликвидности $10–50k эта модель " +
  "проверена хуже всего.",
);
lines.push(
  "* **Незакрытые сделки возвращены по себестоимости.** Их исход неизвестен, " +
  "и подставлять сюда предположение значило бы подогнать итог.",
);
lines.push(
  "* **Прошлое не переносится на будущее.** Месяц одного режима рынка ничего " +
  "не говорит о другом режиме.",
);

console.log(lines.join("\n"));
await prisma.$disconnect();
