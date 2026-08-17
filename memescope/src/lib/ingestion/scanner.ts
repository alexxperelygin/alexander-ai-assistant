import { prisma } from "../db";
import { config, SOL_MINT } from "../config";
import { chainConfig, DEFAULT_CHAIN } from "../chains";
import { getProviders } from "../providers";
import { computeFeatures } from "../features/compute";
import { evaluateHardRejections } from "../risk/engine";
import { computeScores } from "../scoring/engine";
import { buildTradePlan, computePositionSizeUsd, decideStatus } from "../strategy/lifecycle";
import { getRiskSettings } from "../settings";
import { notify } from "../notify/notifier";
import { openPosition } from "../paper/portfolio";
import { VALIDATED_ENTRY, validatedEntryFires } from "../strategy/validated-entry";
import type { ContractRiskReport, MarketSnapshot, OpportunityStatus, RiskSettings, RouteQuote } from "../types";

// One full scan cycle:
//  1) discover new pools → upsert tokens
//  2) pick a bounded batch of candidates (rate-limit friendly)
//  3) enrich: market snapshot, risk report (cached), sell-route quote
//  4) features → hard rejections → scores → lifecycle decision
//  5) persist opportunity + signal transition + notifications
// Every persisted record carries source/dataMode/freshness provenance.

const RISK_REPORT_TTL_MS = 10 * 60 * 1000;
/** Как часто максимум тратим платный запрос соцданных на один токен. */
const SOCIAL_MIN_INTERVAL_MS = 60 * 60 * 1000;
// Only truly finished lifecycles are terminal. AVOID is deliberately NOT here:
// early rejections (too-new, thin liquidity, no data) are transient and the
// token must be re-checked as it matures.
const TERMINAL: OpportunityStatus[] = ["EXIT", "INVALIDATED"];

export async function scanOnce(now = new Date()): Promise<{ discovered: number; evaluated: number }> {
  const providers = getProviders();
  const settings = await getRiskSettings();

  // --- 1. Discovery ---
  let discovered = 0;
  try {
    const tokens = await providers.discovery.discoverNewTokens();
    for (const t of tokens) {
      await prisma.token.upsert({
        where: { chain_mint: { chain: t.chain, mint: t.mint } },
        create: {
          chain: t.chain, mint: t.mint, symbol: t.symbol, name: t.name,
          pairAddress: t.pairAddress, dex: t.dex, pairCreatedAt: t.pairCreatedAt,
        },
        update: { pairAddress: t.pairAddress ?? undefined, dex: t.dex ?? undefined, pairCreatedAt: t.pairCreatedAt ?? undefined },
      });
      discovered++;
    }
  } catch (err) {
    await notify("warning", "Discovery недоступен", `${providers.discovery.name}: ${String(err)}`);
  }

  // --- SOL market regime (cached per cycle) ---
  let solChange24hPct: number | null = null;
  try {
    const solSnap = await providers.market.getMarketSnapshot(SOL_MINT, "solana");
    solChange24hPct = solSnap?.priceChange24h ?? null;
  } catch {
    solChange24hPct = null; // regime unknown → score component reports "нет данных"
  }

  // --- 2. Candidate batch ---
  // Evaluation budget is scarce (rate limits) while discovery floods tens of
  // thousands of tokens per day, so selection matters more than throughput:
  //  a) tokens younger than minTokenAgeMin are NOT evaluated at all — they can
  //     only auto-AVOID ("too-new") and would burn the whole budget;
  //  b) AVOID is NOT terminal: most early rejections (too-new, thin liquidity,
  //     missing data) are transient, so rejected tokens re-enter the queue
  //     least-recently-checked first;
  //  c) slots per cycle: promising (READY/CANDIDATE/WATCH) refresh first, the
  //     rest split between never-evaluated tokens and AVOID re-checks.
  const cutoff = new Date(now.getTime() - settings.maxTokenAgeMin * 60_000);
  const minAgeCutoff = new Date(now.getTime() - settings.minTokenAgeMin * 60_000);
  const ageWindow = {
    mint: { not: SOL_MINT },
    OR: [
      { pairCreatedAt: { gte: cutoff, lte: minAgeCutoff } },
      { pairCreatedAt: null, firstSeenAt: { gte: cutoff, lte: minAgeCutoff } },
    ],
  };
  const slots = config.maxCandidatesPerCycle;
  // d) MEASUREMENT FOLLOW-UPS. Research showed only ~31% of observations ever
  //    got a forward data point, and barely any token was re-observed within
  //    6h of its first scan — so most outcomes were unmeasurable and the
  //    measurable minority was biased toward whatever the scanner happened to
  //    revisit. A fixed share of every cycle is now reserved for re-scanning
  //    tokens we already evaluated, oldest-observation-first, which turns the
  //    snapshot table into a proper panel dataset.
  const followUpSlots = Math.max(1, Math.floor(slots / 3));
  const followUpWindowStart = new Date(now.getTime() - 26 * 3600_000);
  const followUpDue = new Date(now.getTime() - 50 * 60_000);
  const followUps = await prisma.token.findMany({
    where: {
      mint: { not: SOL_MINT },
      snapshots: { some: { fetchedAt: { gte: followUpWindowStart, lte: followUpDue } } },
      NOT: { snapshots: { some: { fetchedAt: { gt: followUpDue } } } },
    },
    orderBy: { firstSeenAt: "desc" },
    take: followUpSlots * 2,
  });

  const promising = await prisma.opportunity.findMany({
    where: { status: { in: ["READY", "CANDIDATE", "WATCH"] }, token: ageWindow },
    orderBy: { updatedAt: "asc" },
    take: slots,
    include: { token: true },
  });
  // Никогда не оценённые токены. Берём с запасом и раскладываем по сетям
  // по очереди: за цикл discovery приносит ~20 пулов из КАЖДОЙ сети, поэтому
  // простая сортировка «сначала свежие» отдала бы почти весь бюджет EVM-сетям
  // и обескровила Solana — единственную сеть с полной проверкой выхода.
  const freshPool = await prisma.token.findMany({
    where: { ...ageWindow, opportunities: { none: {} } },
    orderBy: { firstSeenAt: "desc" }, // just crossed min age — hottest first
    take: slots * 4,
  });
  const fresh = roundRobinByChain(freshPool, slots);
  const recheck = await prisma.opportunity.findMany({
    where: { status: { in: ["AVOID", "DATA_UNAVAILABLE", "HOLD", "BUY", "TAKE_PROFIT"] }, token: ageWindow },
    orderBy: { updatedAt: "asc" }, // least recently re-checked first
    take: slots,
    include: { token: true },
  });

  type Candidate = { token: (typeof fresh)[number]; lastStatus?: OpportunityStatus };
  const seen = new Set<string>();
  const batch: Candidate[] = [];
  const push = (token: (typeof fresh)[number], lastStatus?: OpportunityStatus) => {
    if (batch.length < slots && !seen.has(token.id) && !TERMINAL.includes(lastStatus as OpportunityStatus)) {
      seen.add(token.id);
      batch.push({ token, lastStatus });
    }
  };
  // Follow-ups first, but capped at their reserved share so signal discovery
  // is never starved by measurement.
  for (const t of followUps.slice(0, followUpSlots)) push(t);
  for (const o of promising) push(o.token, o.status as OpportunityStatus);
  // Interleave never-evaluated tokens and AVOID re-checks for the rest.
  for (let i = 0; batch.length < slots && (i < fresh.length || i < recheck.length); i++) {
    const f = fresh[i];
    if (f) push(f);
    const r = recheck[i];
    if (r) push(r.token, r.status as OpportunityStatus);
  }

  // --- 3-5. Evaluate ---
  let evaluated = 0;
  for (const { token } of batch) {
    try {
      await evaluateToken(token.id, token.mint, token.symbol, token.dex, token.pairCreatedAt, {
        chain: token.chain,
        solChange24hPct,
        now,
      });
      evaluated++;
    } catch (err) {
      await prisma.auditLog.create({
        data: { actor: "worker", action: "scan.token.error", details: JSON.stringify({ mint: token.mint, error: String(err) }) },
      }).catch(() => {});
    }
  }

  await prisma.auditLog.create({
    data: { actor: "worker", action: "scan.cycle", details: JSON.stringify({ discovered, evaluated, dataMode: providers.dataMode }) },
  });
  return { discovered, evaluated };
}

/**
 * Раскладывает токены по сетям по очереди: первый из каждой сети, потом второй
 * из каждой и так далее. Порядок внутри сети сохраняется, поэтому «сначала
 * свежие» продолжает работать — меняется только то, что ни одна сеть не может
 * забрать весь бюджет цикла.
 */
export function roundRobinByChain<T extends { chain: string }>(tokens: T[], limit: number): T[] {
  const queues = new Map<string, T[]>();
  for (const t of tokens) {
    const q = queues.get(t.chain);
    if (q) q.push(t);
    else queues.set(t.chain, [t]);
  }
  const out: T[] = [];
  let round = 0;
  while (out.length < limit) {
    let added = false;
    for (const q of queues.values()) {
      const item = q[round];
      if (item) {
        out.push(item);
        added = true;
        if (out.length >= limit) break;
      }
    }
    if (!added) break;
    round++;
  }
  return out;
}

async function evaluateToken(
  tokenId: string,
  mint: string,
  symbol: string,
  dex: string | null,
  pairCreatedAt: Date | null,
  ctx: { chain: string; solChange24hPct: number | null; now: Date },
): Promise<void> {
  const chain = ctx.chain || DEFAULT_CHAIN;
  const chainCfg = chainConfig(chain);
  const providers = getProviders();
  const settings = await getRiskSettings();

  // Предыдущее наблюдение — нужно ДО записи нового, чтобы посчитать, куда
  // движется ликвидность. Это единственный признак ругпулла, доступный заранее.
  const prevSnapshot = await prisma.tokenSnapshot.findFirst({
    where: { tokenId, liquidityUsd: { gt: 0 } },
    orderBy: { fetchedAt: "desc" },
    select: { fetchedAt: true, liquidityUsd: true },
  });

  // Market snapshot.
  let snapshot: MarketSnapshot | null = null;
  try {
    snapshot = await providers.market.getMarketSnapshot(mint, chain);
  } catch {
    snapshot = null;
  }
  if (snapshot) {
    await prisma.tokenSnapshot.create({
      data: {
        tokenId,
        source: snapshot.source,
        dataMode: snapshot.dataMode,
        observedAt: snapshot.observedAt,
        freshnessMs: Math.max(0, Date.now() - snapshot.observedAt.getTime()),
        raw: snapshot.raw ? JSON.stringify(snapshot.raw).slice(0, 4000) : null,
        priceUsd: snapshot.priceUsd,
        liquidityUsd: snapshot.liquidityUsd,
        fdvUsd: snapshot.fdvUsd,
        marketCapUsd: snapshot.marketCapUsd,
        volume5mUsd: snapshot.volume5mUsd,
        volume1hUsd: snapshot.volume1hUsd,
        volume24hUsd: snapshot.volume24hUsd,
        buys5m: snapshot.buys5m,
        sells5m: snapshot.sells5m,
        buys1h: snapshot.buys1h,
        sells1h: snapshot.sells1h,
        priceChange5m: snapshot.priceChange5m,
        priceChange1h: snapshot.priceChange1h,
        priceChange24h: snapshot.priceChange24h,
        holders: snapshot.holders,
        errors: snapshot.errors ? JSON.stringify(snapshot.errors) : null,
      },
    });
    // Enrich token identity/socials from snapshot raw metadata if present.
    const raw = snapshot.raw as { symbol?: string; name?: string; websites?: string[]; socials?: string[]; pairCreatedAt?: number } | undefined;
    if (raw && (raw.symbol || raw.websites?.length || raw.socials?.length || raw.pairCreatedAt)) {
      // DexScreener is the canonical identity source — GeckoTerminal pool
      // names parse into junk like "/Share" for some pools.
      await prisma.token.update({
        where: { id: tokenId },
        data: {
          symbol: raw.symbol?.trim() || undefined,
          name: raw.name?.trim() || undefined,
          website: raw.websites?.[0],
          twitter: raw.socials?.find((s) => s.startsWith("twitter"))?.split(":").slice(1).join(":"),
          pairCreatedAt: !pairCreatedAt && raw.pairCreatedAt ? new Date(raw.pairCreatedAt) : undefined,
        },
      });
      if (!pairCreatedAt && raw.pairCreatedAt) pairCreatedAt = new Date(raw.pairCreatedAt);
    }
  }

  // Budget funnel: RugCheck (~0.5 rps) and Jupiter (~1 rps) are the scarce
  // resources while DexScreener is cheap. A token that fails the liquidity
  // gate is AVOID regardless of its risk report, so we only spend the scarce
  // budget on tokens that could actually become signals.
  const passesLiquidityGate =
    snapshot?.liquidityUsd != null && snapshot.liquidityUsd >= settings.minLiquidityUsd;

  // Risk report (cached).
  let risk: ContractRiskReport | null = null;
  const cached = await prisma.riskReport.findFirst({
    where: { tokenId, fetchedAt: { gte: new Date(Date.now() - RISK_REPORT_TTL_MS) } },
    orderBy: { fetchedAt: "desc" },
  });
  if (cached) {
    risk = {
      source: cached.source,
      dataMode: cached.dataMode as "live" | "mock",
      mintAuthority: cached.mintAuthority ?? undefined,
      freezeAuthority: cached.freezeAuthority ?? undefined,
      top10Pct: cached.top10Pct ?? undefined,
      insiderPct: cached.insiderPct ?? undefined,
      lpLockedPct: cached.lpLockedPct ?? undefined,
      rugged: cached.rugged ?? undefined,
      sellRouteOk: cached.sellRouteOk ?? undefined,
      sellImpactPct: cached.sellImpactPct ?? undefined,
      riskLevel: (cached.riskLevel ?? undefined) as ContractRiskReport["riskLevel"],
      flags: cached.flags ? JSON.parse(cached.flags) : [],
    };
  } else {
    try {
      // RugCheck и Jupiter существуют только для Solana. Для остальных сетей
      // источника контрактных рисков пока нет — вызывать его бессмысленно, а
      // отсутствие проверки честно фиксируется правилом no-contract-risk-source.
      risk =
        passesLiquidityGate && chainCfg?.hasRiskProvider
          ? await providers.risk.getRiskReport(mint, chain)
          : null;
    } catch {
      risk = null;
    }
  }

  // Sell-route quote: only spend the rate budget when the token is not
  // obviously dead (has some liquidity) and risk didn't already kill it.
  const positionUsd = computePositionSizeUsd(settings, snapshot?.liquidityUsd ?? null);
  let sellQuote = null;
  const worthQuoting =
    (chainCfg?.hasRouteProvider ?? false) &&
    snapshot?.liquidityUsd != null &&
    snapshot.liquidityUsd >= settings.minLiquidityUsd &&
    risk?.riskLevel !== "critical" &&
    positionUsd > 0;
  if (worthQuoting) {
    try {
      sellQuote = await providers.routes.getQuote(mint, "sell", positionUsd);
    } catch {
      sellQuote = null;
    }
  }

  if (risk && !cached) {
    await prisma.riskReport.create({
      data: {
        tokenId,
        source: risk.source,
        dataMode: risk.dataMode,
        mintAuthority: risk.mintAuthority,
        freezeAuthority: risk.freezeAuthority,
        top10Pct: risk.top10Pct,
        insiderPct: risk.insiderPct,
        lpLockedPct: risk.lpLockedPct,
        rugged: risk.rugged,
        sellRouteOk: sellQuote?.routeFound ?? risk.sellRouteOk,
        sellImpactPct: sellQuote?.priceImpactPct ?? risk.sellImpactPct,
        riskLevel: risk.riskLevel,
        flags: JSON.stringify(risk.flags),
        raw: risk.raw ? JSON.stringify(risk.raw).slice(0, 4000) : null,
      },
    });
  }

  const rawMeta = snapshot?.raw as { websites?: string[]; socials?: string[] } | undefined;
  const hasSocials = Boolean(rawMeta?.websites?.length || rawMeta?.socials?.length);

  const features = computeFeatures({
    snapshot,
    risk,
    sellQuote,
    pairCreatedAt,
    hasSocials,
    previousLiquidity: prevSnapshot?.liquidityUsd ?? null,
    previousLiquidityAt: prevSnapshot?.fetchedAt ?? null,
    now: ctx.now,
  });
  const rejections = evaluateHardRejections(features, risk, settings, { chain });
  const scores = computeScores(features, risk, {
    positionUsd,
    solChange24hPct: ctx.solChange24hPct,
  });

  const existing = await prisma.opportunity.findFirst({
    where: { tokenId },
    orderBy: { updatedAt: "desc" },
  });
  const decision = decideStatus({
    features,
    scores,
    rejections,
    settings,
    previousStatus: existing?.status as OpportunityStatus | undefined,
  });

  const plan =
    decision.status === "READY" || decision.status === "CANDIDATE"
      ? buildTradePlan({ features, settings, symbol, mint, dex, now: ctx.now })
      : null;

  const risksJson = JSON.stringify(risk?.flags ?? []);
  const data = {
    status: decision.status,
    dataMode: (snapshot?.dataMode ?? providers.dataMode) as string,
    opportunityScore: scores.opportunityScore,
    riskScore: scores.riskScore,
    confidence: scores.confidence,
    scores: JSON.stringify(scores),
    reasons: JSON.stringify(decision.reasons),
    risks: risksJson,
    rejections: rejections.length ? JSON.stringify(rejections) : null,
    plan: plan ? JSON.stringify(plan) : null,
    featuresRef: JSON.stringify(features),
    expiresAt: plan?.validUntil ?? null,
  };

  const opp = existing
    ? await prisma.opportunity.update({ where: { id: existing.id }, data })
    : await prisma.opportunity.create({ data: { tokenId, ...data } });

  // --- Трек проверенного правила (docs/PREREGISTRATION.md) ---
  //
  // Специально СНАРУЖИ проверки статуса и снаружи блока «статус изменился»:
  // правило, прошедшее проверку, не смотрит ни на score, ни на READY, ни на
  // риск-отчёт — только на ликвидность и на признак артефакта листинга.
  // Пропустить его через конвейер скоринга значило бы проверять живьём не то
  // правило, которое проверку прошло.
  await maybeOpenValidatedEntry({ tokenId, symbol, opportunityId: opp.id, snapshot, sellQuote, settings });

  // Кого опрашивать. Сначала стояло «только READY и CANDIDATE» — по расходу это
  // безопасно, но для ИССЛЕДОВАНИЯ бесполезно: у горстки лучших по score
  // токенов почти нет разброса ни в соцактивности, ни в исходах, а без
  // разброса предсказательную силу измерить нечем. Опрашиваем всех, кто прошёл
  // порог ликвидности: это осмысленная вселенная (её же видит стратегия), в
  // ней есть и удачные, и провальные исходы. Расход ограничен потолками внутри
  // самих провайдеров.
  if (passesLiquidityGate && decision.status !== "DATA_UNAVAILABLE") {
    for (const social of providers.socials) {
      const lastSocial = await prisma.socialSnapshot.findFirst({
        where: { tokenId, source: social.name },
        orderBy: { fetchedAt: "desc" },
        select: { fetchedAt: true },
      });
      const dueAt = ctx.now.getTime() - SOCIAL_MIN_INTERVAL_MS;
      if (lastSocial && lastSocial.fetchedAt.getTime() >= dueAt) continue;
      try {
        // Ищем по адресу контракта: тикеры совпадают у сотен токенов, адрес — нет.
        const stats = await social.getSocialStats(mint, 60, ctx.now);
        if (!stats) continue;
        await prisma.socialSnapshot.create({
          data: {
            tokenId,
            source: stats.source,
            dataMode: stats.dataMode,
            windowMin: stats.windowMin,
            postsRead: stats.postsRead,
            mentions: stats.mentions,
            uniqueAuthors: stats.uniqueAuthors,
            reach: stats.reach,
            engagement: stats.engagement,
            freshAccountShare: stats.freshAccountShare,
            medianAuthorAgeDays: stats.medianAuthorAgeDays,
            errors: stats.errors?.length ? JSON.stringify(stats.errors) : null,
          },
        });
      } catch (err) {
        // Сбой одного источника не должен ни ронять оценку токена, ни мешать
        // остальным источникам.
        await prisma.auditLog.create({
          data: {
            actor: "worker",
            action: "social.error",
            details: JSON.stringify({ mint, source: social.name, error: String(err) }),
          },
        }).catch(() => {});
      }
    }
  }

  const prevStatus = existing?.status;
  if (prevStatus !== decision.status) {
    await prisma.signalEvent.create({
      data: {
        opportunityId: opp.id,
        fromStatus: prevStatus ?? null,
        toStatus: decision.status,
        reason: decision.reasons.join(" | "),
        // features are snapshotted here (not just referenced) — Opportunity.featuresRef
        // is overwritten on every re-evaluation, so past decisions were not
        // reconstructable for research without this.
        payload: JSON.stringify({ opportunityScore: scores.opportunityScore, riskScore: scores.riskScore, confidence: scores.confidence, plan, features }),
      },
    });
    if (decision.status === "READY") {
      await notify(
        "info",
        `READY: ${symbol}`,
        [
          `Токен ${symbol} (${mint}) получил статус READY.`,
          `Score ${scores.opportunityScore.toFixed(1)}, Risk ${scores.riskScore.toFixed(1)}, confidence ${(scores.confidence * 100).toFixed(0)}%.`,
          `Режим данных: ${data.dataMode.toUpperCase()}.`,
          plan ? `План: вход $${plan.entryLowUsd.toPrecision(4)}–$${plan.entryHighUsd.toPrecision(4)}, размер $${plan.positionSizeUsd.toFixed(0)}, slippage ≤${plan.maxSlippagePct}%.` : "",
          `Это исследовательский сигнал, не гарантия прибыли. Покупку подтверждаете вы.`,
        ].filter(Boolean).join("\n"),
      );

      // Auto paper-trade every READY signal (simulation only, no real funds):
      // this builds the execution-quality statistics (fills, stops, TPs, P&L)
      // that gate any future decision about live trading. All risk limits in
      // openPosition (exposure cap, daily loss, cooldown) still apply.
      if (settings.paperTradingEnabled && plan && snapshot?.priceUsd != null) {
        const openPos = await prisma.position.findFirst({
          where: { tokenId, status: { in: ["OPEN", "PARTIAL_EXIT"] } },
        });
        if (!openPos) {
          try {
            await openPosition({
              tokenId,
              opportunityId: opp.id,
              mode: "paper",
              priceUsd: snapshot.priceUsd,
              sizeUsd: plan.positionSizeUsd,
              liquidityUsd: snapshot.liquidityUsd ?? null,
              observedImpactPct: sellQuote?.priceImpactPct ?? null,
              plan,
            });
          } catch (err) {
            // Risk limits refusing a trade is normal operation — record why.
            await prisma.auditLog.create({
              data: { actor: "worker", action: "paper.autoopen.skipped", details: JSON.stringify({ mint, reason: String(err) }) },
            }).catch(() => {});
          }
        }
      }
    }
  }
}

/**
 * Живой прогон правила входа, прошедшего проверку из `docs/PREREGISTRATION.md`.
 *
 * До 17 августа бумажный портфель торговал ТОЛЬКО по конвейеру скоринга —
 * стратегии, про которую backtest говорит NO EDGE и которая на живых сделках
 * теряет деньги ровно так, как backtest предсказывает. Правило же, прошедшее
 * все пять предзарегистрированных критериев, живой проверки не получало
 * вообще: оно считалось пересчётом по записанным снапшотам. Единственный
 * имеющийся живой стенд стоял под заведомо нерабочей стратегией.
 *
 * Чем этот прогон отличается от пересчёта — и почему это ценно:
 *  · вход исполняется симулятором заявки (проскальзывание от размера позиции
 *    к ликвидности, комиссия), а не берётся по котировке;
 *  · выход считает монитор по прямому запросу цены раз в 30 секунд, то есть
 *    трейлинг-стоп срабатывает по реальной наблюдаемости, а не по частоте,
 *    с которой сканер случайно заглянул в токен;
 *  · закрытие происходит вперёд по времени и переписать его задним числом
 *    нельзя.
 *
 * Чем он ХУЖЕ пересчёта, названо заранее: есть потолок одновременно открытых
 * позиций, поэтому берутся не все подходящие входы подряд, а те, что
 * подвернулись при свободном слоте. Отказы по этой причине пишутся в журнал —
 * по ним потом можно оценить, сколько входов пропущено и когда.
 */
async function maybeOpenValidatedEntry(ctx: {
  tokenId: string;
  symbol: string;
  opportunityId: string;
  snapshot: MarketSnapshot | null;
  sellQuote: RouteQuote | null;
  settings: RiskSettings;
}): Promise<void> {
  if (!ctx.settings.paperTradingEnabled) return;
  const s = ctx.snapshot;
  if (!s) return;

  const verdict = validatedEntryFires({
    liquidityUsd: s.liquidityUsd,
    priceUsd: s.priceUsd,
    priceChange1h: s.priceChange1h,
    priceChange24h: s.priceChange24h,
  });
  if (!verdict.fires) return;

  // Одна сделка на токен — это часть замороженного правила, а не удобство:
  // без него один и тот же удачный токен попадал бы в выборку по несколько
  // раз и в одиночку определял бы средний результат.
  const already = await prisma.position.findFirst({
    where: { tokenId: ctx.tokenId, entryRule: "validated-liquidity" },
  });
  if (already) return;
  // Открытая позиция другого трека по этому же токену — тоже стоп. Две
  // позиции на один токен запутали бы и мониторинг, и разбор результата.
  const openAny = await prisma.position.findFirst({
    where: { tokenId: ctx.tokenId, status: { in: ["OPEN", "PARTIAL_EXIT"] } },
  });
  if (openAny) return;

  try {
    await openPosition({
      tokenId: ctx.tokenId,
      opportunityId: ctx.opportunityId,
      mode: "paper",
      entryRule: "validated-liquidity",
      priceUsd: s.priceUsd as number,
      sizeUsd: VALIDATED_ENTRY.positionSizeUsd,
      liquidityUsd: s.liquidityUsd ?? null,
      observedImpactPct: ctx.sellQuote?.priceImpactPct ?? null,
      plan: null,
    });
  } catch (err) {
    // Отказ — нормальная работа, но он ИСКАЖАЕТ выборку, поэтому пишется
    // весь: по этим записям видно, сколько входов правило дало бы без
    // потолка слотов и в какие моменты они пропускались.
    await prisma.auditLog.create({
      data: {
        actor: "worker",
        action: "validated.entry.skipped",
        details: JSON.stringify({ symbol: ctx.symbol, tokenId: ctx.tokenId, reason: String(err) }),
      },
    }).catch(() => {});
  }
}
