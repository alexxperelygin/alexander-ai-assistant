import { chainConfig } from "../chains";
import { fetchJson } from "./http";

// Чтение состояния пула напрямую из блокчейна.
//
// ЗАЧЕМ. Котировочные источники перестают отдавать цену раньше, чем токен
// перестаёт торговаться, и делают это не случайно: молчат прежде всего по
// умирающим токенам. Позиция в этот момент закрывается по последней известной
// цене — то есть по цене ДО обвала, — и результат записывается лучше, чем он
// был на самом деле. К 26 августа так закрывалось 92 сделки из 203 в одном
// треке и 121 из 163 в другом; коридор результата стал шире измеряемого
// эффекта, и накопление сделок этого уже не исправляло.
//
// Резервы пула — первичные данные. Их отдаёт сам блокчейн, а не посредник,
// и отдаёт ровно тогда, когда посредник замолчал.
//
// ЧЕГО ЭТО НЕ ДЕЛАЕТ. Резервы дают цену и глубину, но не заменяют симуляцию
// сделки: реальный выход упрётся ещё и в комиссию пула, проскальзывание и
// возможный honeypot. Здесь считается только то, что видно в резервах.

/** Сигнатуры вызовов. Первые 4 байта keccak от прототипа функции. */
const SIG = {
  token0: "0x0dfe1681",
  token1: "0xd21220a7",
  getReserves: "0x0902f1ac",
  decimals: "0x313ce567",
  slot0: "0x3850c7bd",
  balanceOf: "0x70a08231",
} as const;

/** Стейблкоины по сетям: для них курс к доллару принимается за единицу. */
const STABLES: Record<string, Set<string>> = {
  base: new Set([
    "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", // USDC
    "0xd9aaec86b65d86f6a7b5b1b0c42ffa531710b6ca", // USDbC
    "0x50c5725949a6f0c72e6c4a641f24049a917db0cb", // DAI
  ]),
  bsc: new Set([
    "0x55d398326f99059ff775485246999027b3197955", // USDT
    "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d", // USDC
    "0xe9e7cea3dedca5984780bafc599bd69add087d56", // BUSD
  ]),
  ethereum: new Set([
    "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", // USDC
    "0xdac17f958d2ee523a2206206994597c13d831ec7", // USDT
    "0x6b175474e89094c44da98b954eedeac495271d0f", // DAI
  ]),
  arbitrum: new Set([
    "0xaf88d065e77c8cc2239327c5edb3a432268e5831", // USDC
    "0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9", // USDT
    "0xff970a61a04b1ca14834a43f5de4533ebddb5cc8", // USDC.e
  ]),
};

export interface PoolState {
  priceUsd: number;
  liquidityUsd: number;
  /** Как получена цена: по резервам (v2) или по текущему тику (v3). */
  kind: "v2" | "v3";
}

interface PoolMeta {
  token0: string;
  token1: string;
  dec0: number;
  dec1: number;
  kind: "v2" | "v3";
}

/** Состав пары неизменен, поэтому кешируется навсегда. */
const metaCache = new Map<string, PoolMeta | null>();
/** Курс обёрнутой нативной монеты живёт минуту: этого хватает для оценки. */
const nativeUsdCache = new Map<string, { usd: number; at: number }>();
const NATIVE_TTL_MS = 60_000;

async function ethCall(chain: string, to: string, data: string): Promise<string | null> {
  const cfg = chainConfig(chain);
  if (!cfg?.rpcUrl) return null;
  try {
    const res = await fetchJson<{ result?: string; error?: { message: string } }>(cfg.rpcUrl, {
      source: `rpc:${chain}`,
      minIntervalMs: 120,
      timeoutMs: 8_000,
      body: { jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to, data }, "latest"] },
    });
    // Revert — это ответ, а не сбой связи: у пула V3 нет getReserves, и мы
    // узнаём об этом именно так. Наверх идёт null, вызывающий пробует иначе.
    if (res.error || !res.result || res.result === "0x") return null;
    return res.result;
  } catch {
    return null;
  }
}

/** Слово N (32 байта) из ответа eth_call. */
function word(hex: string, n: number): string | null {
  const body = hex.slice(2);
  const start = n * 64;
  if (body.length < start + 64) return null;
  return body.slice(start, start + 64);
}

function wordToBigInt(hex: string, n: number): bigint | null {
  const w = word(hex, n);
  return w == null ? null : BigInt("0x" + w);
}

function wordToAddress(hex: string, n: number): string | null {
  const w = word(hex, n);
  return w == null ? null : "0x" + w.slice(24);
}

/**
 * Целое с фиксированной точкой в число. Через строку, а не Number(bigint):
 * у мем-токенов встречается supply в 10^27, и наивное деление теряет всё
 * значащее ещё до запятой.
 */
function scaled(v: bigint, decimals: number): number {
  if (v === 0n) return 0;
  const s = v.toString();
  if (decimals === 0) return Number(s);
  const pad = s.padStart(decimals + 1, "0");
  const int = pad.slice(0, pad.length - decimals);
  const frac = pad.slice(pad.length - decimals);
  return Number(`${int}.${frac}`);
}

async function poolMeta(chain: string, pair: string): Promise<PoolMeta | null> {
  const key = `${chain}:${pair.toLowerCase()}`;
  const hit = metaCache.get(key);
  if (hit !== undefined) return hit;

  const [t0raw, t1raw] = await Promise.all([
    ethCall(chain, pair, SIG.token0),
    ethCall(chain, pair, SIG.token1),
  ]);
  const token0 = t0raw && wordToAddress(t0raw, 0);
  const token1 = t1raw && wordToAddress(t1raw, 0);
  if (!token0 || !token1) {
    metaCache.set(key, null);
    return null;
  }
  const [d0raw, d1raw, reserves] = await Promise.all([
    ethCall(chain, token0, SIG.decimals),
    ethCall(chain, token1, SIG.decimals),
    ethCall(chain, pair, SIG.getReserves),
  ]);
  const dec0 = d0raw ? Number(wordToBigInt(d0raw, 0) ?? 18n) : 18;
  const dec1 = d1raw ? Number(wordToBigInt(d1raw, 0) ?? 18n) : 18;
  const meta: PoolMeta = {
    token0: token0.toLowerCase(),
    token1: token1.toLowerCase(),
    dec0,
    dec1,
    // getReserves есть только у пар постоянного произведения. Ответил —
    // значит V2-подобный пул, промолчал — считаем по тику V3.
    kind: reserves ? "v2" : "v3",
  };
  metaCache.set(key, meta);
  return meta;
}

/** Курс обёрнутой нативной монеты в долларах — через котировочный источник. */
async function nativeUsd(chain: string): Promise<number | null> {
  const cfg = chainConfig(chain);
  if (!cfg?.wrappedNative) return null;
  const hit = nativeUsdCache.get(chain);
  if (hit && Date.now() - hit.at < NATIVE_TTL_MS) return hit.usd;
  try {
    const json = await fetchJson<{ pairs: { chainId: string; priceUsd?: string; liquidity?: { usd?: number } }[] | null }>(
      `https://api.dexscreener.com/latest/dex/tokens/${cfg.wrappedNative.address}`,
      { source: "dexscreener", minIntervalMs: 250 },
    );
    const best = (json.pairs ?? [])
      .filter((p) => p.chainId === chain && p.priceUsd)
      .sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0];
    const usd = best?.priceUsd ? parseFloat(best.priceUsd) : NaN;
    if (!Number.isFinite(usd) || usd <= 0) return hit?.usd ?? null;
    nativeUsdCache.set(chain, { usd, at: Date.now() });
    return usd;
  } catch {
    // Просроченный курс лучше отсутствия: он двигается на проценты в час,
    // а цена мем-токена — на порядки. Ошибка от этого несопоставимо меньше.
    return hit?.usd ?? null;
  }
}

/** Курс второй стороны пары в долларах. */
async function quoteUsd(chain: string, quote: string): Promise<number | null> {
  if (STABLES[chain]?.has(quote)) return 1;
  const cfg = chainConfig(chain);
  if (cfg?.wrappedNative && cfg.wrappedNative.address.toLowerCase() === quote) {
    return nativeUsd(chain);
  }
  // Пара не к доллару и не к нативной монете: пересчитать не из чего.
  // Молча подставить единицу было бы хуже отказа — это выдумать цену.
  return null;
}

/**
 * Цена и глубина пула по его собственному состоянию.
 * null означает «прочитать не удалось» — вызывающий обязан отличать это от нуля.
 */
export async function readPoolState(
  chain: string,
  pairAddress: string,
  tokenAddress: string,
): Promise<PoolState | null> {
  const cfg = chainConfig(chain);
  if (!cfg?.rpcUrl) return null;

  const meta = await poolMeta(chain, pairAddress);
  if (!meta) return null;

  const token = tokenAddress.toLowerCase();
  if (token !== meta.token0 && token !== meta.token1) return null;
  const tokenIsZero = token === meta.token0;
  const quote = tokenIsZero ? meta.token1 : meta.token0;
  const decToken = tokenIsZero ? meta.dec0 : meta.dec1;
  const decQuote = tokenIsZero ? meta.dec1 : meta.dec0;

  const qUsd = await quoteUsd(chain, quote);
  if (qUsd == null) return null;

  if (meta.kind === "v2") {
    const raw = await ethCall(chain, pairAddress, SIG.getReserves);
    if (!raw) return null;
    const r0 = wordToBigInt(raw, 0);
    const r1 = wordToBigInt(raw, 1);
    if (r0 == null || r1 == null) return null;
    const resToken = scaled(tokenIsZero ? r0 : r1, decToken);
    const resQuote = scaled(tokenIsZero ? r1 : r0, decQuote);
    if (resToken <= 0 || resQuote <= 0) return null;
    const priceUsd = (resQuote / resToken) * qUsd;
    if (!Number.isFinite(priceUsd) || priceUsd <= 0) return null;
    // Обе стороны пула по построению равны по стоимости, поэтому глубина —
    // удвоенная сторона котировки. Так же считает и котировочный источник,
    // иначе числа перестали бы сравниваться между собой.
    return { priceUsd, liquidityUsd: resQuote * qUsd * 2, kind: "v2" };
  }

  // V3: цена берётся из текущего тика, а не из отношения остатков — при
  // сосредоточенной ликвидности это разные величины.
  const raw = await ethCall(chain, pairAddress, SIG.slot0);
  const sqrtX96 = raw ? wordToBigInt(raw, 0) : null;
  if (sqrtX96 == null || sqrtX96 === 0n) return null;
  // (sqrt/2^96)^2 = цена token0, выраженная в token1, в их «сырых» единицах.
  // Возводим в квадрат УЖЕ отношение: sqrtX96 доходит до 2^160, и квадрат
  // такого числа теряет значащие разряды раньше, чем само отношение.
  const Q96 = 2n ** 96n;
  const ratio = scaled(sqrtX96, 0) / scaled(Q96, 0);
  const price0in1raw = ratio * ratio;
  if (!Number.isFinite(price0in1raw) || price0in1raw <= 0) return null;
  const price0in1 = price0in1raw * 10 ** (meta.dec0 - meta.dec1);
  const priceInQuote = tokenIsZero ? price0in1 : 1 / price0in1;
  const priceUsd = priceInQuote * qUsd;
  if (!Number.isFinite(priceUsd) || priceUsd <= 0) return null;

  // Глубина V3 считается по реальным остаткам на адресе пула. Это ВЕРХНЯЯ
  // оценка доступного объёма: часть ликвидности стоит вне текущего диапазона
  // и в сделке не участвует. Занижать глубину безопаснее, чем завышать,
  // поэтому здесь это отмечено, а не сглажено.
  // balanceOf спрашиваем У КОНТРАКТА КОТИРУЕМОГО ТОКЕНА про адрес пула:
  // сколько этого токена лежит на пуле.
  const holder = pairAddress.toLowerCase().replace("0x", "").padStart(64, "0");
  const bq = await ethCall(chain, quote, SIG.balanceOf + holder);
  const quoteBal = bq ? wordToBigInt(bq, 0) : null;
  const liquidityUsd = quoteBal == null ? 0 : scaled(quoteBal, decQuote) * qUsd * 2;
  return { priceUsd, liquidityUsd, kind: "v3" };
}

/** Умеет ли система читать пул этой сети напрямую. */
export function canReadOnchain(chain: string): boolean {
  return Boolean(chainConfig(chain)?.rpcUrl);
}
