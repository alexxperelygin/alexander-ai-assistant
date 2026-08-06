import { describe, expect, it } from "vitest";
import { summarize } from "../src/lib/providers/x";

const now = new Date("2026-08-06T00:00:00Z");
const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000).toISOString();

describe("X social summary", () => {
  it("counts authors once even when they post repeatedly", () => {
    const s = summarize(
      {
        data: [
          { id: "1", author_id: "a" },
          { id: "2", author_id: "a" },
          { id: "3", author_id: "b" },
        ],
        includes: {
          users: [
            { id: "a", created_at: daysAgo(400), public_metrics: { followers_count: 1000 } },
            { id: "b", created_at: daysAgo(200), public_metrics: { followers_count: 500 } },
          ],
        },
      },
      now,
    );
    expect(s.mentions).toBe(3);
    expect(s.uniqueAuthors).toBe(2);
    expect(s.reach).toBe(1500); // охват считается по авторам, не по постам
  });

  it("exposes the share of brand-new accounts", () => {
    const s = summarize(
      {
        data: [
          { id: "1", author_id: "new1" },
          { id: "2", author_id: "new2" },
          { id: "3", author_id: "old" },
        ],
        includes: {
          users: [
            { id: "new1", created_at: daysAgo(2) },
            { id: "new2", created_at: daysAgo(5) },
            { id: "old", created_at: daysAgo(900) },
          ],
        },
      },
      now,
    );
    expect(s.freshAccountShare).toBeCloseTo(2 / 3);
    expect(s.medianAuthorAgeDays).toBeCloseTo(5);
  });

  it("says unknown rather than zero when no account age is available", () => {
    const s = summarize({ data: [{ id: "1", author_id: "a" }], includes: { users: [{ id: "a" }] } }, now);
    expect(s.freshAccountShare).toBeNull();
    expect(s.medianAuthorAgeDays).toBeNull();
  });

  it("sums engagement across posts", () => {
    const s = summarize(
      {
        data: [
          { id: "1", author_id: "a", public_metrics: { like_count: 5, retweet_count: 2, reply_count: 1 } },
          { id: "2", author_id: "b", public_metrics: { like_count: 3 } },
        ],
      },
      now,
    );
    expect(s.engagement).toBe(11);
  });

  it("reports an empty result without inventing numbers", () => {
    const s = summarize({ meta: { result_count: 0 } }, now);
    expect(s.mentions).toBe(0);
    expect(s.postsRead).toBe(0);
    expect(s.reach).toBe(0);
    expect(s.freshAccountShare).toBeNull();
  });
});
