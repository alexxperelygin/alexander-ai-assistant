import { prisma } from "../db";
import { config, SOL_MINT } from "../config";
import { getProviders } from "../providers";
import { computeFeatures } from "../features/compute";
import { evaluateHardRejections } from "../risk/engine";
import { computeScores } from "../scoring/engine";
import { buildTradePlan, computePositionSizeUsd, decideStatus } from "../strategy/lifecycle";
import { getRiskSettings } from "../settings";
import { notify } from "../notify/notifier";
import type { ContractRiskReport, MarketSnapshot, OpportunityStatus } from "../types";

// One full scan cycle:
//  1) discover new pools → upsert tokens
//  2) pick a bounded batch of candidates (rate-limit friendly)
//  3) enrich: market snapshot, risk report (cached), sell-route quote
//  4) features → hard rejections → scores → lifecycle decision
//  5) persist opportunity + signal transition + notifications
// Every persisted record carries source/dataMode/freshness provenance.

const RISK_REPORT_TTL_MS = 10 * 60 * 1000;
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
        where: { mint: t.mint },
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
    const solSnap = await providers.market.getMarketSnapshot(SOL_MINT);
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

  const promising = await prisma.opportunity.findMany({
    where: { status: { in: ["READY", "CANDIDATE", "WATCH"] }, token: ageWindow },
    orderBy: { updatedAt: "asc" },
    take: slots,
    include: { token: true },
  });
  const fresh = await prisma.token.findMany({
    where: { ...ageWindow, opportunities: { none: {} } },
    orderBy: { firstSeenAt: "desc" }, // just crossed min age — hottest first
    take: slots,
  });
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

async function evaluateToken(
  tokenId: string,
  mint: string,
  symbol: string,
  dex: string | null,
  pairCreatedAt: Date | null,
  ctx: { solChange24hPct: number | null; now: Date },
): Promise<void> {
  const providers = getProviders();
  const settings = await getRiskSettings();

  // Market snapshot.
  let snapshot: MarketSnapshot | null = null;
  try {
    snapshot = await providers.market.getMarketSnapshot(mint);
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
      risk = await providers.risk.getRiskReport(mint);
    } catch {
      risk = null;
    }
  }

  // Sell-route quote: only spend the rate budget when the token is not
  // obviously dead (has some liquidity) and risk didn't already kill it.
  const positionUsd = computePositionSizeUsd(settings, snapshot?.liquidityUsd ?? null);
  let sellQuote = null;
  const worthQuoting =
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
    now: ctx.now,
  });
  const rejections = evaluateHardRejections(features, risk, settings);
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

  const prevStatus = existing?.status;
  if (prevStatus !== decision.status) {
    await prisma.signalEvent.create({
      data: {
        opportunityId: opp.id,
        fromStatus: prevStatus ?? null,
        toStatus: decision.status,
        reason: decision.reasons.join(" | "),
        payload: JSON.stringify({ opportunityScore: scores.opportunityScore, riskScore: scores.riskScore, confidence: scores.confidence, plan }),
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
    }
  }
}
