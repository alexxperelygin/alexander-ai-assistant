import { prisma } from "../db";
import type { SocialProvider, SocialStats } from "./types";

// X (Twitter) API v2 — платный источник. Ключ берётся из X_BEARER_TOKEN;
// без ключа провайдер честно возвращает null, и система работает как раньше.
//
// ГЛАВНОЕ ОГРАНИЧЕНИЕ — квота. Базовый тариф даёт порядка 10 000 прочитанных
// постов в МЕСЯЦ. Опрашивать ими тысячи токенов бессмысленно: лимит сгорит за
// пару дней и данных всё равно не хватит. Поэтому:
//   * запрос делается только по токенам, уже прошедшим фильтры (десятки в день);
//   * ищем по адресу контракта, а не по тикеру — тикеры совпадают у сотен
//     токенов, адрес уникален, поэтому выборка чистая без ручной разметки;
//   * расход считается по факту прочитанных постов и жёстко ограничен
//     месячным бюджетом, чтобы лимит не кончился неожиданно.
//
// Мем-соцсети — среда с массовой накруткой, поэтому одного числа упоминаний
// мало. Собираем ещё возраст аккаунтов и охват: десять упоминаний от старых
// аккаунтов с аудиторией и десять от аккаунтов, созданных вчера, — разные
// события. Предсказательная сила этого проверяется в исследовании, как и всё
// остальное; в скоринг ничего не добавляется до проверки.

const SEARCH_URL = "https://api.x.com/2/tweets/search/recent";

/** Сколько постов в месяц разрешено прочитать (запас к тарифу). */
const MONTHLY_POST_BUDGET = Number(process.env.X_MONTHLY_POST_BUDGET ?? 9000);
/** Сколько постов максимум за один запрос. */
const MAX_RESULTS = Number(process.env.X_MAX_RESULTS ?? 10);

interface XUser {
  id: string;
  created_at?: string;
  public_metrics?: { followers_count?: number };
}

interface XTweet {
  id: string;
  author_id?: string;
  public_metrics?: { like_count?: number; retweet_count?: number; reply_count?: number };
}

interface XResponse {
  data?: XTweet[];
  includes?: { users?: XUser[] };
  meta?: { result_count?: number };
}

const median = (xs: number[]): number | null => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? (s[m] as number) : ((s[m - 1] as number) + (s[m] as number)) / 2;
};

/**
 * Считает метрики из ответа X. Вынесено отдельно и экспортировано, потому что
 * это единственная часть, которую можно проверить тестом без платного ключа.
 */
export function summarize(res: XResponse, now: Date): Omit<SocialStats, "source" | "dataMode" | "windowMin"> {
  const tweets = res.data ?? [];
  const users = new Map((res.includes?.users ?? []).map((u) => [u.id, u]));
  const authorIds = new Set(tweets.map((t) => t.author_id).filter((x): x is string => x != null));

  const ages: number[] = [];
  let reach = 0;
  for (const id of authorIds) {
    const u = users.get(id);
    if (!u) continue;
    reach += u.public_metrics?.followers_count ?? 0;
    if (u.created_at) {
      const days = (now.getTime() - new Date(u.created_at).getTime()) / 86_400_000;
      if (Number.isFinite(days) && days >= 0) ages.push(days);
    }
  }

  const engagement = tweets.reduce(
    (s, t) =>
      s +
      (t.public_metrics?.like_count ?? 0) +
      (t.public_metrics?.retweet_count ?? 0) +
      (t.public_metrics?.reply_count ?? 0),
    0,
  );

  return {
    postsRead: tweets.length,
    mentions: tweets.length,
    uniqueAuthors: authorIds.size,
    reach,
    engagement,
    // Доля свежих аккаунтов считается только если возраст известен хотя бы у
    // одного автора — иначе это не «ноль ботов», а «не знаем».
    freshAccountShare: ages.length ? ages.filter((d) => d < 30).length / ages.length : null,
    medianAuthorAgeDays: median(ages),
  };
}

/** Сколько постов уже прочитано в текущем календарном месяце. */
export async function postsReadThisMonth(now = new Date()): Promise<number> {
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const agg = await prisma.socialSnapshot.aggregate({
    where: { source: "x", fetchedAt: { gte: monthStart } },
    _sum: { postsRead: true },
  });
  return agg._sum.postsRead ?? 0;
}

export class XSocial implements SocialProvider {
  readonly name = "x";

  isConfigured(): boolean {
    return Boolean(process.env.X_BEARER_TOKEN);
  }

  async getSocialStats(query: string, windowMin = 60, now = new Date()): Promise<SocialStats | null> {
    const token = process.env.X_BEARER_TOKEN;
    if (!token) return null;

    const spent = await postsReadThisMonth(now);
    if (spent + MAX_RESULTS > MONTHLY_POST_BUDGET) {
      // Лимит почти исчерпан. Молча читать дальше нельзя: у платного тарифа
      // перерасход означает либо счёт, либо блокировку до конца месяца.
      return {
        source: this.name,
        dataMode: "live",
        windowMin,
        postsRead: 0,
        mentions: null,
        uniqueAuthors: null,
        reach: null,
        engagement: null,
        freshAccountShare: null,
        medianAuthorAgeDays: null,
        errors: [`месячный бюджет X исчерпан: прочитано ${spent} из ${MONTHLY_POST_BUDGET}`],
      };
    }

    const params = new URLSearchParams({
      query: `"${query}" -is:retweet`,
      max_results: String(Math.max(10, MAX_RESULTS)), // API требует минимум 10
      "tweet.fields": "created_at,public_metrics,author_id",
      expansions: "author_id",
      "user.fields": "created_at,public_metrics",
    });

    const res = await fetch(`${SEARCH_URL}?${params}`, {
      headers: { authorization: `Bearer ${token}`, accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`x: HTTP ${res.status}`);
    const json = (await res.json()) as XResponse;

    return {
      source: this.name,
      dataMode: "live",
      windowMin,
      ...summarize(json, now),
    };
  }
}
