import { describe, it, expect } from "vitest";
import { addWorkingDays, countWorkingDays } from "../working-days";

// Reference: src/lib/working-days.ts treats Saturday (getDay() === 6) as
// the only weekend day — Sun→Fri are all working days. Tests anchor on
// fixed dates so the suite is timezone-independent.

describe("addWorkingDays", () => {
  it("returns a clone when days <= 0", () => {
    const start = new Date("2026-04-15T00:00:00Z");
    const out = addWorkingDays(start, 0);
    expect(out.getTime()).toBe(start.getTime());
    expect(out).not.toBe(start); // different reference
  });

  it("skips Saturdays when accumulating", () => {
    // Sun 2026-04-19 + 1 working day → Mon 2026-04-20
    const sun = new Date("2026-04-19T00:00:00Z");
    const out = addWorkingDays(sun, 1);
    expect(out.toISOString().slice(0, 10)).toBe("2026-04-20");
  });

  it("jumps Friday → Sunday across the Saturday weekend", () => {
    // Fri 2026-04-17 + 1 working day → Sun 2026-04-19 (skips Sat 2026-04-18)
    const fri = new Date("2026-04-17T00:00:00Z");
    const out = addWorkingDays(fri, 1);
    expect(out.toISOString().slice(0, 10)).toBe("2026-04-19");
  });

  it("adds 6 working days across one weekend = 7 calendar days", () => {
    // Sun 2026-04-19 + 6 working days → Sun 2026-04-26
    const sun = new Date("2026-04-19T00:00:00Z");
    const out = addWorkingDays(sun, 6);
    expect(out.toISOString().slice(0, 10)).toBe("2026-04-26");
  });
});

describe("countWorkingDays", () => {
  it("counts 0 for same-day range", () => {
    const d = new Date("2026-04-20T00:00:00Z");
    expect(countWorkingDays(d, d)).toBe(0);
  });

  it("counts 1 for a single working-day step", () => {
    const start = new Date("2026-04-19T00:00:00Z"); // Sunday
    const end = new Date("2026-04-20T00:00:00Z");   // Monday
    expect(countWorkingDays(start, end)).toBe(1);
  });

  it("skips Saturdays when counting", () => {
    // Fri 2026-04-17 → Sun 2026-04-19 = 1 working day (only Sunday counts,
    // Saturday in between is skipped)
    const fri = new Date("2026-04-17T00:00:00Z");
    const sun = new Date("2026-04-19T00:00:00Z");
    expect(countWorkingDays(fri, sun)).toBe(1);
  });

  it("is the inverse of addWorkingDays for a typical span", () => {
    const start = new Date("2026-04-19T00:00:00Z");
    for (const n of [1, 3, 5, 10, 25, 60]) {
      const end = addWorkingDays(start, n);
      expect(countWorkingDays(start, end)).toBe(n);
    }
  });
});
