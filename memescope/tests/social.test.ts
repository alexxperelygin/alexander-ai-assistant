import { describe, expect, it } from "vitest";
import { summarizeReddit } from "../src/lib/providers/reddit";
import { summarizeFarcaster } from "../src/lib/providers/farcaster";

const now = new Date("2026-08-06T12:00:00Z");
const minutesAgo = (m: number) => now.getTime() - m * 60_000;

describe("Reddit summary", () => {
  it("keeps posts inside the window but bills for everything read", () => {
    const s = summarizeReddit(
      {
        data: {
          children: [
            { data: { author: "a", score: 10, num_comments: 2, created_utc: minutesAgo(10) / 1000 } },
            { data: { author: "b", score: 5, num_comments: 0, created_utc: minutesAgo(30) / 1000 } },
            // За пределами часа — в упоминания не идёт, но источник его отдал.
            { data: { author: "c", score: 99, num_comments: 9, created_utc: minutesAgo(600) / 1000 } },
          ],
        },
      },
      60,
      now,
    );
    expect(s.mentions).toBe(2);
    expect(s.postsRead).toBe(3);
    expect(s.uniqueAuthors).toBe(2);
    expect(s.engagement).toBe(17);
  });

  it("does not count deleted authors as people", () => {
    const s = summarizeReddit(
      { data: { children: [{ data: { author: "[deleted]", created_utc: minutesAgo(5) / 1000 } }] } },
      60,
      now,
    );
    expect(s.uniqueAuthors).toBe(0);
  });

  it("reports unknown reach rather than zero", () => {
    // Reddit не отдаёт подписчиков автора: это «не знаем», а не «охват нулевой».
    const s = summarizeReddit({ data: { children: [] } }, 60, now);
    expect(s.reach).toBeNull();
    expect(s.freshAccountShare).toBeNull();
  });
});

describe("Farcaster summary", () => {
  it("counts each author's audience once", () => {
    const s = summarizeFarcaster(
      {
        result: {
          casts: [
            { author: { fid: 1, follower_count: 900 }, timestamp: new Date(minutesAgo(5)).toISOString(), reactions: { likes_count: 3 } },
            { author: { fid: 1, follower_count: 900 }, timestamp: new Date(minutesAgo(6)).toISOString(), reactions: { likes_count: 1 } },
            { author: { fid: 2, follower_count: 100 }, timestamp: new Date(minutesAgo(7)).toISOString(), replies: { count: 2 } },
          ],
        },
      },
      60,
      now,
    );
    expect(s.uniqueAuthors).toBe(2);
    expect(s.reach).toBe(1000); // 900 + 100, а не 900 + 900 + 100
    expect(s.engagement).toBe(6);
  });

  it("drops casts older than the window", () => {
    const s = summarizeFarcaster(
      {
        result: {
          casts: [
            { author: { fid: 1 }, timestamp: new Date(minutesAgo(5)).toISOString() },
            { author: { fid: 2 }, timestamp: new Date(minutesAgo(240)).toISOString() },
          ],
        },
      },
      60,
      now,
    );
    expect(s.mentions).toBe(1);
    expect(s.postsRead).toBe(2);
  });

  it("handles an empty response", () => {
    const s = summarizeFarcaster({}, 60, now);
    expect(s.mentions).toBe(0);
    expect(s.uniqueAuthors).toBe(0);
  });
});
