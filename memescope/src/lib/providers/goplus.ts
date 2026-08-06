import type { ContractRiskReport, RiskFlag } from "../types";
import type { RiskProvider } from "./types";
import { chainConfig } from "../chains";
import { fetchJson } from "./http";

// GoPlus Security — проверка контрактов в EVM-сетях (бесплатно, без ключа).
// Docs: https://docs.gopluslabs.io/reference/response-details
//
// Закрывает ровно тот пробел, из-за которого EVM-сети не могли выдавать сигнал:
// honeypot (купить можно, продать нельзя), доп-эмиссия, остановка переводов,
// налоги на покупку/продажу, концентрация держателей, блокировка LP.
//
// Ответ приходит строками "0"/"1"/"" — пустая строка означает «источник не
// смог проверить», и это НЕ то же самое, что «безопасно». Поэтому пустое
// значение превращается в undefined (нет данных), а не в false.

interface GpHolder {
  address?: string;
  percent?: string;
  is_locked?: number;
  is_contract?: number;
  tag?: string;
}

interface GpToken {
  is_honeypot?: string;
  cannot_sell_all?: string;
  is_mintable?: string;
  transfer_pausable?: string;
  is_open_source?: string;
  is_proxy?: string;
  hidden_owner?: string;
  can_take_back_ownership?: string;
  is_blacklisted?: string;
  buy_tax?: string;
  sell_tax?: string;
  holder_count?: string;
  holders?: GpHolder[];
  lp_holders?: GpHolder[];
  owner_address?: string;
}

/** "1" → true, "0" → false, пусто/отсутствует → undefined (нет данных). */
function flag(v: string | undefined): boolean | undefined {
  if (v === "1") return true;
  if (v === "0") return false;
  return undefined;
}

function pctNum(v: string | undefined): number | null {
  if (v == null || v === "") return null;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Доля предложения у 10 крупнейших держателей-людей.
 * Контракты пулов и локеры исключаются по тем же причинам, что и в RugCheck:
 * иначе почти любой токен выглядит как предельно сконцентрированный.
 * Экспортируется для тестов.
 */
export function computeTop10Pct(holders: GpHolder[] | undefined): number | null {
  if (!holders?.length) return null;
  const people = holders.filter((h) => {
    const tag = (h.tag ?? "").toLowerCase();
    const infra = h.is_contract === 1 || tag.includes("lock") || tag.includes("pool") || tag.includes("lp");
    return !infra;
  });
  if (people.length === 0) return null;
  const sum = people
    .slice(0, 10)
    .reduce((s, h) => s + (pctNum(h.percent) ?? 0) * 100, 0); // GoPlus отдаёт долю 0..1
  if (!Number.isFinite(sum) || sum > 95) return null; // похоже на мусор в данных
  return sum;
}

/** Доля LP, лежащая в локерах или сожжённая. */
export function computeLpLockedPct(lpHolders: GpHolder[] | undefined): number | null {
  if (!lpHolders?.length) return null;
  const locked = lpHolders
    .filter((h) => h.is_locked === 1)
    .reduce((s, h) => s + (pctNum(h.percent) ?? 0) * 100, 0);
  return Number.isFinite(locked) ? Math.min(100, locked) : null;
}

export class GoPlusRisk implements RiskProvider {
  readonly name = "goplus";

  async getRiskReport(address: string, chain?: string): Promise<ContractRiskReport | null> {
    const cfg = chain ? chainConfig(chain) : null;
    if (!cfg?.goplusChainId) return null; // сеть не поддерживается — врать нечем

    const json = await fetchJson<{ code?: number; result?: Record<string, GpToken> }>(
      `https://api.gopluslabs.io/api/v1/token_security/${cfg.goplusChainId}?contract_addresses=${address}`,
      { source: this.name, minIntervalMs: 2100 },
    );
    // Ключ в ответе — адрес в нижнем регистре.
    const t = json.result?.[address.toLowerCase()] ?? Object.values(json.result ?? {})[0];
    if (!t) return null;

    const flags: RiskFlag[] = [];
    const honeypot = flag(t.is_honeypot);
    const cannotSellAll = flag(t.cannot_sell_all);
    const buyTax = pctNum(t.buy_tax);
    const sellTax = pctNum(t.sell_tax);

    if (honeypot === true)
      flags.push({ name: "honeypot", severity: "critical", description: "Контракт помечен как honeypot: продажа заблокирована." });
    if (cannotSellAll === true)
      flags.push({ name: "cannot-sell-all", severity: "critical", description: "Нельзя продать всю позицию — частичная блокировка выхода." });
    if (flag(t.is_open_source) === false)
      flags.push({ name: "closed-source", severity: "danger", description: "Исходный код контракта не опубликован — поведение непроверяемо." });
    if (flag(t.hidden_owner) === true)
      flags.push({ name: "hidden-owner", severity: "danger", description: "У контракта скрытый владелец." });
    if (flag(t.can_take_back_ownership) === true)
      flags.push({ name: "ownership-reclaim", severity: "danger", description: "Владение контрактом можно вернуть себе после отказа." });
    if (flag(t.is_blacklisted) === true)
      flags.push({ name: "blacklist", severity: "danger", description: "Контракт умеет вносить адреса в чёрный список." });
    if (flag(t.is_proxy) === true)
      flags.push({ name: "proxy", severity: "warning", description: "Прокси-контракт: логику можно подменить после запуска." });
    // Налог считается в долях (0.05 = 5%).
    if (sellTax != null && sellTax > 0.1)
      flags.push({ name: "high-sell-tax", severity: "danger", description: `Налог на продажу ${(sellTax * 100).toFixed(1)}%.` });
    if (buyTax != null && buyTax > 0.1)
      flags.push({ name: "high-buy-tax", severity: "warning", description: `Налог на покупку ${(buyTax * 100).toFixed(1)}%.` });

    const critical = flags.some((f) => f.severity === "critical");
    const dangers = flags.filter((f) => f.severity === "danger").length;

    return {
      source: this.name,
      dataMode: "live",
      // Доп-эмиссия и остановка переводов — прямые аналоги mint/freeze authority.
      mintAuthority: flag(t.is_mintable),
      freezeAuthority: flag(t.transfer_pausable),
      top10Pct: computeTop10Pct(t.holders) ?? undefined,
      lpLockedPct: computeLpLockedPct(t.lp_holders) ?? undefined,
      // Продажа считается подтверждённой, только если источник ЯВНО сказал, что
      // токен не honeypot. Отсутствие данных не подтверждает ничего.
      sellRouteOk: honeypot === false && cannotSellAll !== true ? true : honeypot === true || cannotSellAll === true ? false : undefined,
      riskLevel: critical ? "critical" : dangers >= 2 ? "high" : dangers === 1 ? "medium" : "low",
      flags,
      raw: t,
    };
  }
}
