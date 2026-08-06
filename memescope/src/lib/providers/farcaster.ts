import type { SocialProvider, SocialStats } from "./types";

// Farcaster через Neynar. Ключ: NEYNAR_API_KEY (у них есть бесплатный уровень).
// Без ключа провайдер возвращает null.
//
// Почему именно Neynar, а не открытый узел сети: узел (hub) отвечает без ключа,
// но умеет только «отдай пост по идентификатору». Поиска по тексту в нём нет,
// а нам нужно найти упоминания адреса контракта. Проверено запросом к
// hub.pinata.cloud: HTTP 200, но нужного эндпоинта нет.
//
// Farcaster интересен тем, что вход в сеть платный и требует ончейн-регистрации,
// поэтому массовая накрутка там дороже, чем в X. Проверять это всё равно надо
// данными, а не рассуждением.

const SEARCH_URL = "https://api.neynar.com/v2/farcaster/cast/search";
const MAX_RESULTS = Number(process.env.NEYNAR_MAX_RESULTS ?? 25);

interface NeynarAuthor {
  fid?: number;
  follower_count?: number;
}

interface NeynarCast {
  hash?: string;
  text?: string;
  timestamp?: string;
  author?: NeynarAuthor;
  reactions?: { likes_count?: number; recasts_count?: number };
  replies?: { count?: number };
}

interface NeynarResponse {
  result?: { casts?: NeynarCast[] };
}

/** Считает метрики из ответа Neynar. Экспортировано ради теста без ключа. */
export function summarizeFarcaster(
  res: NeynarResponse,
  windowMin: number,
  now: Date,
  query?: string,
): Omit<SocialStats, "source" | "dataMode" | "windowMin"> {
  const all = res.result?.casts ?? [];
  // Поиск у Neynar нечёткий: по адресу контракта он возвращает и посты, где
  // этого адреса нет. Первый прогон дал 55 «упоминаний» по одному токену —
  // столько обсуждений у нового токена не бывает. Поэтому оставляем только те
  // посты, в тексте которых адрес действительно есть: иначе мы измеряли бы
  // не внимание к токену, а работу чужого поискового движка.
  const needle = query?.toLowerCase();
  const matched = needle
    ? all.filter((c) => (c.text ?? "").toLowerCase().includes(needle))
    : all;
  const cutoff = now.getTime() - windowMin * 60_000;
  const casts = matched.filter((c) => {
    if (!c.timestamp) return true;
    const t = new Date(c.timestamp).getTime();
    return !Number.isFinite(t) || t >= cutoff;
  });

  const authors = new Map<number, number>();
  for (const c of casts) {
    const fid = c.author?.fid;
    if (fid != null) authors.set(fid, c.author?.follower_count ?? 0);
  }
  const reach = [...authors.values()].reduce((s, v) => s + v, 0);
  const engagement = casts.reduce(
    (s, c) =>
      s +
      (c.reactions?.likes_count ?? 0) +
      (c.reactions?.recasts_count ?? 0) +
      (c.replies?.count ?? 0),
    0,
  );

  return {
    postsRead: all.length,
    mentions: casts.length,
    uniqueAuthors: authors.size,
    reach,
    engagement,
    // Дата регистрации аккаунта в ответе поиска не приходит: отдельный запрос
    // на каждого автора не окупается. Не знаем — значит null.
    freshAccountShare: null,
    medianAuthorAgeDays: null,
  };
}

export class FarcasterSocial implements SocialProvider {
  readonly name = "farcaster";

  isConfigured(): boolean {
    return Boolean(process.env.NEYNAR_API_KEY);
  }

  async getSocialStats(query: string, windowMin = 60, now = new Date()): Promise<SocialStats | null> {
    const key = process.env.NEYNAR_API_KEY;
    if (!key) return null;

    const params = new URLSearchParams({ q: query, limit: String(MAX_RESULTS) });
    // Текст нужен, чтобы отсеять нерелевантную выдачу нечёткого поиска.
    const res = await fetch(`${SEARCH_URL}?${params}`, {
      headers: { api_key: key, "x-api-key": key, accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`farcaster: HTTP ${res.status}`);
    const json = (await res.json()) as NeynarResponse;

    return {
      source: this.name,
      dataMode: "live",
      windowMin,
      ...summarizeFarcaster(json, windowMin, now, query),
    };
  }
}
