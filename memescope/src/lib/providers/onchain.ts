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
  /** StateView.getSlot0(bytes32) — цена пула Uniswap V4 по его poolId. */
  v4Slot0: "0xc815641c",
  /** StateView.getLiquidity(bytes32) — активная ликвидность пула V4. */
  v4Liquidity: "0xfa6793d5",
} as const;

/**
 * Нативная монета внутри Uniswap V4 обозначается нулевым адресом: пул может
 * держать ETH напрямую, без обёртки. Спрашивать decimals() у нулевого адреса
 * бессмысленно — у нативной монеты их всегда 18.
 */
const NATIVE_CURRENCY = "0x0000000000000000000000000000000000000000";

/** Тема события PoolManager.Initialize — по ней восстанавливается состав пары. */
const V4_INITIALIZE_TOPIC =
  "0xdd466e674ea557f56295e2d0218a125ea4b4f0f6f3307b95f85e6110838d6438";

/** «Адрес пары» длиной 32 байта — это не контракт, а poolId Uniswap V4. */
function isPoolId(value: string): boolean {
  return /^0x[0-9a-fA-F]{64}$/.test(value);
}

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
  /**
   * Глубина пула в долларах. null — глубину прочитать НЕ УДАЛОСЬ, и это не то
   * же самое, что ноль: ноль означает «прочитали, пул пуст». Разница не
   * косметическая. Симуляция сделки отказывается работать при неизвестной
   * глубине, и такой отказ уводит сделку в «неизмеримые», то есть вон из
   * статистики. А пустой пул — это измеренный и притом ХУДШИЙ исход, он обязан
   * остаться в статистике полным списанием. Записывать одно числом другого
   * значит систематически выбрасывать худшие сделки и завышать все итоги.
   */
  liquidityUsd: number | null;
  /** Как получена цена: по резервам (v2), по тику пула (v3) или по тику V4. */
  kind: "v2" | "v3" | "v4";
}

interface PoolMeta {
  token0: string;
  token1: string;
  dec0: number;
  dec1: number;
  kind: "v2" | "v3" | "v4";
}

/**
 * Состав пары неизменен, поэтому удачный ответ кешируется навсегда.
 *
 * А вот НЕУДАЧУ навсегда запоминать нельзя. Раньше так и было, и для пар V2/V3
 * это сходило с рук: там неудача означала «это не пул». Для V4 состав пары
 * ищется сканированием журнала событий, а оно может не дойти по сети — и пул,
 * не прочитанный один раз из-за таймаута, молча оставался нечитаемым до
 * перезапуска воркера. Это ровно тот тихий отказ, ради устранения которого
 * чтение пулов и писалось. Поэтому у отрицательного ответа есть срок.
 */
const metaCache = new Map<string, { meta: PoolMeta | null; at: number }>();
const META_MISS_TTL_MS = 30 * 60_000;
/** Курс второй стороны пары живёт минуту: этого хватает для оценки. */
const quoteUsdCache = new Map<string, { usd: number; at: number }>();
const QUOTE_TTL_MS = 60_000;

async function rpc<T>(chain: string, method: string, params: unknown[]): Promise<T | null> {
  const cfg = chainConfig(chain);
  if (!cfg?.rpcUrl) return null;
  try {
    const res = await fetchJson<{ result?: T; error?: { message: string } }>(cfg.rpcUrl, {
      source: `rpc:${chain}`,
      minIntervalMs: 120,
      timeoutMs: 8_000,
      body: { jsonrpc: "2.0", id: 1, method, params },
    });
    // Revert — это ответ, а не сбой связи: у пула V3 нет getReserves, и мы
    // узнаём об этом именно так. Наверх идёт null, вызывающий пробует иначе.
    if (res.error || res.result == null) return null;
    return res.result;
  } catch {
    return null;
  }
}

async function ethCall(chain: string, to: string, data: string): Promise<string | null> {
  const res = await rpc<string>(chain, "eth_call", [{ to, data }, "latest"]);
  return res && res !== "0x" ? res : null;
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

function cachedMeta(key: string): PoolMeta | null | undefined {
  const hit = metaCache.get(key);
  if (hit === undefined) return undefined;
  if (hit.meta) return hit.meta;
  return Date.now() - hit.at < META_MISS_TTL_MS ? null : undefined;
}

function rememberMeta(key: string, meta: PoolMeta | null): PoolMeta | null {
  metaCache.set(key, { meta, at: Date.now() });
  return meta;
}

/** Знаков после запятой у валюты пула; у нативной монеты их всегда 18. */
async function currencyDecimals(chain: string, currency: string): Promise<number> {
  if (currency === NATIVE_CURRENCY) return 18;
  const raw = await ethCall(chain, currency, SIG.decimals);
  return raw ? Number(wordToBigInt(raw, 0) ?? 18n) : 18;
}

/**
 * Состав пула Uniswap V4 по его poolId.
 *
 * poolId — это keccak от ключа пула, обратно он не разбирается. Единственный
 * способ узнать валюты — найти событие Initialize, которым пул заведён. Журнал
 * у публичных узлов отдаётся окнами не больше 10 000 блоков, поэтому окно
 * наводится по времени создания пула, если оно известно, и лишь иначе журнал
 * просматривается назад от текущего блока.
 */
async function v4Meta(chain: string, poolId: string, createdAt?: Date | null): Promise<PoolMeta | null> {
  const cfg = chainConfig(chain);
  if (!cfg?.v4) return null;
  const { poolManager, blockTimeSec } = cfg.v4;

  const headHex = await rpc<string>(chain, "eth_blockNumber", []);
  if (!headHex) return null;
  const head = Number(BigInt(headHex));
  if (!Number.isFinite(head) || head <= 0) return null;

  const SPAN = 9_500;
  const windows: [number, number][] = [];
  if (createdAt) {
    // Прицел по времени создания: оценка блока плюс запас в обе стороны.
    // Промах по времени возможен, поэтому соседние окна тоже просматриваются.
    const ageBlocks = Math.floor((Date.now() - createdAt.getTime()) / 1000 / blockTimeSec);
    const est = Math.max(0, head - ageBlocks);
    for (const shift of [0, -SPAN, SPAN, -2 * SPAN, 2 * SPAN]) {
      const hi = Math.min(head, est + Math.floor(SPAN / 2) + shift);
      windows.push([Math.max(0, hi - SPAN), hi]);
    }
  }
  // Запасной проход: сплошь назад от головы. Нужен, когда времени создания нет
  // или оно разошлось с реальным блоком — например, если источник записал его
  // приблизительно. Дороже прицельного, но случается только при промахе, а
  // тихо остаться без цены дороже: именно этим и была вызвана вся правка.
  // Токены старше недели в работу не берутся, дальше искать незачем.
  const maxBlocks = Math.ceil((7 * 24 * 3600) / blockTimeSec);
  for (let back = 0; back < maxBlocks; back += SPAN) {
    const hi = head - back;
    if (hi <= 0) break;
    windows.push([Math.max(0, hi - SPAN), hi]);
  }

  for (const [from, to] of windows) {
    const logs = await rpc<{ topics: string[] }[]>(chain, "eth_getLogs", [
      {
        address: poolManager,
        fromBlock: "0x" + from.toString(16),
        toBlock: "0x" + to.toString(16),
        topics: [V4_INITIALIZE_TOPIC, poolId.toLowerCase()],
      },
    ]);
    const topics = logs?.[0]?.topics;
    if (!topics || topics.length < 4) continue;
    const c0 = topics[2] && "0x" + topics[2].slice(26);
    const c1 = topics[3] && "0x" + topics[3].slice(26);
    if (!c0 || !c1) continue;
    const token0 = c0.toLowerCase();
    const token1 = c1.toLowerCase();
    const [dec0, dec1] = await Promise.all([
      currencyDecimals(chain, token0),
      currencyDecimals(chain, token1),
    ]);
    return { token0, token1, dec0, dec1, kind: "v4" };
  }
  return null;
}

async function poolMeta(chain: string, pair: string, createdAt?: Date | null): Promise<PoolMeta | null> {
  const key = `${chain}:${pair.toLowerCase()}`;
  const hit = cachedMeta(key);
  if (hit !== undefined) return hit;

  if (isPoolId(pair)) return rememberMeta(key, await v4Meta(chain, pair, createdAt));

  const [t0raw, t1raw] = await Promise.all([
    ethCall(chain, pair, SIG.token0),
    ethCall(chain, pair, SIG.token1),
  ]);
  const token0 = t0raw && wordToAddress(t0raw, 0);
  const token1 = t1raw && wordToAddress(t1raw, 0);
  if (!token0 || !token1) return rememberMeta(key, null);
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
  return rememberMeta(key, meta);
}

/**
 * Курс произвольного токена в долларах через котировочный источник.
 *
 * Здесь это НЕ противоречие с самой идеей читать пул из блокчейна. Молчит
 * источник по нашему мем-токену — по нему и нет ни пар, ни объёма. Вторая же
 * сторона пары (нативная монета, стейбл или крупный токен сети) котируется
 * нормально: именно её курс и нужен, чтобы перевести цену из единиц пары
 * в доллары.
 */
async function marketUsd(chain: string, address: string): Promise<number | null> {
  const key = `${chain}:${address}`;
  const hit = quoteUsdCache.get(key);
  if (hit && Date.now() - hit.at < QUOTE_TTL_MS) return hit.usd;
  try {
    const json = await fetchJson<{ pairs: { chainId: string; priceUsd?: string; liquidity?: { usd?: number } }[] | null }>(
      `https://api.dexscreener.com/latest/dex/tokens/${address}`,
      { source: "dexscreener", minIntervalMs: 250 },
    );
    const best = (json.pairs ?? [])
      .filter((p) => p.chainId === chain && p.priceUsd)
      .sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0];
    const usd = best?.priceUsd ? parseFloat(best.priceUsd) : NaN;
    if (!Number.isFinite(usd) || usd <= 0) return hit?.usd ?? null;
    quoteUsdCache.set(key, { usd, at: Date.now() });
    return usd;
  } catch {
    // Просроченный курс лучше отсутствия: он двигается на проценты в час,
    // а цена мем-токена — на порядки. Ошибка от этого несопоставимо меньше.
    return hit?.usd ?? null;
  }
}

/** Курс обёрнутой нативной монеты в долларах. */
async function nativeUsd(chain: string): Promise<number | null> {
  const cfg = chainConfig(chain);
  if (!cfg?.wrappedNative) return null;
  return marketUsd(chain, cfg.wrappedNative.address);
}

/** Курс второй стороны пары в долларах. */
async function quoteUsd(chain: string, quote: string): Promise<number | null> {
  if (STABLES[chain]?.has(quote)) return 1;
  const cfg = chainConfig(chain);
  // В Uniswap V4 нативная монета лежит в пуле без обёртки и обозначается
  // нулевым адресом. Для курса это та же самая монета.
  if (quote === NATIVE_CURRENCY) return nativeUsd(chain);
  if (cfg?.wrappedNative && cfg.wrappedNative.address.toLowerCase() === quote) {
    return nativeUsd(chain);
  }
  // Пара не к доллару и не к нативной монете. 28 августа выяснилось, что таких
  // пар среди наших позиций много: на base мем-токены заводят пулы к другим
  // токенам сети. Прежде мы в этом месте просто отказывались считать — и
  // сделка закрывалась по устаревшей цене, то есть по допущению. Спросить курс
  // второй стороны честнее: она ликвидна и котируется. Если источник не знает
  // и её — отказ остаётся, выдумывать единицу нельзя.
  return marketUsd(chain, quote);
}

/**
 * Цена и глубина пула по его собственному состоянию.
 * null означает «прочитать не удалось» — вызывающий обязан отличать это от нуля.
 */
export async function readPoolState(
  chain: string,
  pairAddress: string,
  tokenAddress: string,
  /** Время создания пары: наводит поиск события Initialize у пулов V4. */
  pairCreatedAt?: Date | null,
): Promise<PoolState | null> {
  const cfg = chainConfig(chain);
  if (!cfg?.rpcUrl) return null;

  const meta = await poolMeta(chain, pairAddress, pairCreatedAt);
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

  // V3 и V4: цена берётся из текущего тика, а не из отношения остатков — при
  // сосредоточенной ликвидности это разные величины. Отличается только то, у
  // кого спрашивать: у V4 своего контракта нет, состояние лежит в общем
  // хранилище и запрашивается по poolId.
  const v4 = meta.kind === "v4" ? cfg.v4 : null;
  if (meta.kind === "v4" && !v4) return null;
  const poolArg = pairAddress.toLowerCase().replace("0x", "").padStart(64, "0");
  const raw = v4
    ? await ethCall(chain, v4.stateView, SIG.v4Slot0 + poolArg)
    : await ethCall(chain, pairAddress, SIG.slot0);
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

  if (v4) {
    // У пула V4 нет своего адреса, поэтому остатки на нём не спросишь: средства
    // всех пулов лежат в общем хранилище одной кучей. Считаем по активной
    // ликвидности: x = L / sqrtP, y = L * sqrtP — это «виртуальные резервы»,
    // то есть та пара V2, которая вела бы себя у текущей цены так же.
    //
    // ЭТО ОЦЕНКА СВЕРХУ, и молчать об этом нельзя: виртуальные резервы
    // описывают диапазон вплоть до нуля, а настоящая ликвидность стоит в узкой
    // полосе вокруг цены. Завышенная глубина делает аварийный выход по обвалу
    // ликвидности менее чутким. Выбор здесь между этой оценкой и закрытием по
    // устаревшей цене — то есть по числу, которое вообще ничего не измеряет.
    const lraw = await ethCall(chain, v4.stateView, SIG.v4Liquidity + poolArg);
    const L = lraw ? wordToBigInt(lraw, 0) : null;
    // Вызов не прошёл — глубина неизвестна; вернулся ноль — пул пуст.
    if (lraw == null) return { priceUsd, liquidityUsd: null, kind: "v4" };
    if (L == null || L === 0n) return { priceUsd, liquidityUsd: 0, kind: "v4" };
    const lNum = scaled(L, 0);
    // ratio = sqrtP в сырых единицах; сторона котировки зависит от порядка.
    const quoteRaw = tokenIsZero ? lNum * ratio : lNum / ratio;
    const liquidityUsd = (quoteRaw / 10 ** decQuote) * qUsd * 2;
    return { priceUsd, liquidityUsd: Number.isFinite(liquidityUsd) ? liquidityUsd : 0, kind: "v4" };
  }

  // Глубина V3 считается по реальным остаткам на адресе пула. Это ВЕРХНЯЯ
  // оценка доступного объёма: часть ликвидности стоит вне текущего диапазона
  // и в сделке не участвует. Занижать глубину безопаснее, чем завышать,
  // поэтому здесь это отмечено, а не сглажено.
  // balanceOf спрашиваем У КОНТРАКТА КОТИРУЕМОГО ТОКЕНА про адрес пула:
  // сколько этого токена лежит на пуле.
  const holder = pairAddress.toLowerCase().replace("0x", "").padStart(64, "0");
  const bq = await ethCall(chain, quote, SIG.balanceOf + holder);
  const quoteBal = bq ? wordToBigInt(bq, 0) : null;
  // Неудавшийся вызов раньше превращался в ноль, и «не смогли прочитать»
  // становилось неотличимо от «пул пуст». Теперь это разные ответы.
  const liquidityUsd = quoteBal == null ? null : scaled(quoteBal, decQuote) * qUsd * 2;
  return { priceUsd, liquidityUsd, kind: "v3" };
}

/** Умеет ли система читать пул этой сети напрямую. */
export function canReadOnchain(chain: string): boolean {
  return Boolean(chainConfig(chain)?.rpcUrl);
}
