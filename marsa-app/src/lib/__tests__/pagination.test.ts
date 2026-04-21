import { describe, it, expect } from "vitest";
import { parsePagination, paginationMeta } from "../pagination";

describe("parsePagination", () => {
  it("returns defaults when no params are present", () => {
    const { page, take, skip } = parsePagination(new URL("https://x.test/y"));
    expect(page).toBe(1);
    expect(take).toBe(50);
    expect(skip).toBe(0);
  });

  it("honors custom page + take", () => {
    const { page, take, skip } = parsePagination(
      new URL("https://x.test/y?page=3&take=20")
    );
    expect(page).toBe(3);
    expect(take).toBe(20);
    expect(skip).toBe(40);
  });

  it("clamps take to maxTake", () => {
    const { take } = parsePagination(new URL("https://x.test/y?take=9999"));
    expect(take).toBe(200); // default MAX_TAKE
  });

  it("rejects non-positive page and falls back to 1", () => {
    const { page, skip } = parsePagination(new URL("https://x.test/y?page=-5"));
    expect(page).toBe(1);
    expect(skip).toBe(0);
  });

  it("rejects non-positive take and falls back to the default", () => {
    const { take } = parsePagination(new URL("https://x.test/y?take=0"));
    expect(take).toBe(50);
  });

  it("rejects garbage values and uses defaults", () => {
    const { page, take } = parsePagination(
      new URL("https://x.test/y?page=abc&take=xyz")
    );
    expect(page).toBe(1);
    expect(take).toBe(50);
  });

  it("respects custom defaultTake / maxTake arguments", () => {
    const { take: defaultT } = parsePagination(
      new URL("https://x.test/y"),
      25,
      100
    );
    expect(defaultT).toBe(25);

    const { take: cappedT } = parsePagination(
      new URL("https://x.test/y?take=500"),
      25,
      100
    );
    expect(cappedT).toBe(100);
  });
});

describe("paginationMeta", () => {
  it("computes pages and hasMore correctly mid-list", () => {
    const meta = paginationMeta(125, 2, 50);
    expect(meta.total).toBe(125);
    expect(meta.page).toBe(2);
    expect(meta.take).toBe(50);
    expect(meta.pages).toBe(3); // ceil(125 / 50)
    expect(meta.hasMore).toBe(true); // 2 * 50 = 100 < 125
  });

  it("reports hasMore=false on the last full page", () => {
    const meta = paginationMeta(100, 2, 50);
    expect(meta.pages).toBe(2);
    expect(meta.hasMore).toBe(false); // 2 * 50 = 100, not < 100
  });

  it("reports hasMore=false on a partial last page", () => {
    const meta = paginationMeta(110, 3, 50);
    expect(meta.pages).toBe(3); // ceil(110 / 50)
    expect(meta.hasMore).toBe(false); // 3 * 50 = 150, not < 110
  });

  it("handles empty result set", () => {
    const meta = paginationMeta(0, 1, 50);
    expect(meta.pages).toBe(0);
    expect(meta.hasMore).toBe(false);
  });
});
