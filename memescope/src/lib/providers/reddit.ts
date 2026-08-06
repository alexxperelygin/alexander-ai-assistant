import type { SocialProvider, SocialStats } from "./types";

// Reddit API — бесплатный, но с 2023 года требует регистрации приложения.
// Ключи: REDDIT_CLIENT_ID / REDDIT_CLIENT_SECRET (тип приложения "script").
// Без них провайдер возвращает null и система работает как раньше.
//
// Анонимный доступ к .json намеренно НЕ используется: Reddit отвечает на него
// 403, а обход ограничений запрещён заданием — и практически означал бы бан по
// IP сервера, на котором работают другие приложения владельца.
//
// Чего Reddit НЕ даёт дёшево: возраст аккаунта автора. Он требует отдельного
// запроса на каждого автора, то есть десятков запросов на один токен. Поэтому
// поля возраста остаются null — «не знаем», а не «ботов нет».

const TOKEN_URL = "https://www.reddit.com/api/v1/access_token";
const SEARCH_URL = "https://oauth.reddit.com/search";

/** Reddit просит осмысленный User-Agent; имя пользователя — часть соглашения. */
const USER_AGENT = process.env.REDDIT_USER_AGENT ?? "linux:memescope-ai-research:0.1 (research)";
const MAX_RESULTS = Number(process.env.REDDIT_MAX_RESULTS ?? 25);

interface RedditPost {
  author?: string;
  score?: number;
  num_comments?: number;
  created_utc?: number;
  subreddit?: string;
}

interface RedditListing {
  data?: { children?: { data?: RedditPost }[] };
}

/**
 * Считает метрики из ответа Reddit. Экспортировано ради теста без ключей.
 * Окно фильтруется здесь, а не в запросе: Reddit умеет ограничивать выдачу
 * только сутками, а нам нужен час.
 */
export function summarizeReddit(
  listing: RedditListing,
  windowMin: number,
  now: Date,
): Omit<SocialStats, "source" | "dataMode" | "windowMin"> {
  const all = (listing.data?.children ?? [])
    .map((c) => c.data)
    .filter((p): p is RedditPost => p != null);
  const cutoffSec = (now.getTime() - windowMin * 60_000) / 1000;
  const posts = all.filter((p) => p.created_utc == null || p.created_utc >= cutoffSec);

  const authors = new Set(
    posts.map((p) => p.author).filter((a): a is string => a != null && a !== "[deleted]"),
  );
  const engagement = posts.reduce((s, p) => s + (p.score ?? 0) + (p.num_comments ?? 0), 0);

  return {
    // Расход считаем по прочитанному, а не по подошедшему под окно: платит
    // источник за всё, что отдал.
    postsRead: all.length,
    mentions: posts.length,
    uniqueAuthors: authors.size,
    // Подписчиков у автора поста Reddit не отдаёт — охват неизвестен.
    reach: null,
    engagement,
    freshAccountShare: null,
    medianAuthorAgeDays: null,
  };
}

export class RedditSocial implements SocialProvider {
  readonly name = "reddit";
  private token: { value: string; expiresAt: number } | null = null;

  isConfigured(): boolean {
    return Boolean(process.env.REDDIT_CLIENT_ID && process.env.REDDIT_CLIENT_SECRET);
  }

  private async accessToken(): Promise<string | null> {
    const id = process.env.REDDIT_CLIENT_ID;
    const secret = process.env.REDDIT_CLIENT_SECRET;
    if (!id || !secret) return null;
    if (this.token && this.token.expiresAt > Date.now() + 60_000) return this.token.value;

    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
        "content-type": "application/x-www-form-urlencoded",
        "user-agent": USER_AGENT,
      },
      body: "grant_type=client_credentials",
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`reddit: авторизация HTTP ${res.status}`);
    const json = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!json.access_token) throw new Error("reddit: ответ без access_token");
    this.token = {
      value: json.access_token,
      expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
    };
    return this.token.value;
  }

  async getSocialStats(query: string, windowMin = 60, now = new Date()): Promise<SocialStats | null> {
    const token = await this.accessToken();
    if (!token) return null;

    const params = new URLSearchParams({
      q: `"${query}"`,
      limit: String(MAX_RESULTS),
      sort: "new",
      t: "day", // сузить сильнее API не умеет — окно применяем сами
      type: "link",
    });
    const res = await fetch(`${SEARCH_URL}?${params}`, {
      headers: { authorization: `Bearer ${token}`, "user-agent": USER_AGENT },
      signal: AbortSignal.timeout(15_000),
    });
    if (res.status === 401) {
      this.token = null; // токен протух раньше срока — пусть перевыпустится
      throw new Error("reddit: HTTP 401");
    }
    if (!res.ok) throw new Error(`reddit: HTTP ${res.status}`);
    const json = (await res.json()) as RedditListing;

    return {
      source: this.name,
      dataMode: "live",
      windowMin,
      ...summarizeReddit(json, windowMin, now),
    };
  }
}
