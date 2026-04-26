import { describe, it, expect } from "vitest";
import {
  getEffectiveDeadline,
  isProjectOverdue,
  daysRemainingForProject,
} from "../project-deadline";

const d = (s: string) => new Date(s);

describe("getEffectiveDeadline", () => {
  it("returns endDate when only endDate is set", () => {
    expect(getEffectiveDeadline({ endDate: d("2026-06-01") })?.toISOString()).toBe(
      d("2026-06-01").toISOString(),
    );
  });

  it("returns contractEndDate when only contractEndDate is set", () => {
    expect(
      getEffectiveDeadline({ contractEndDate: d("2026-05-01") })?.toISOString(),
    ).toBe(d("2026-05-01").toISOString());
  });

  it("returns contract.endDate when only contract relation has it", () => {
    expect(
      getEffectiveDeadline({ contract: { endDate: d("2026-04-01") } })?.toISOString(),
    ).toBe(d("2026-04-01").toISOString());
  });

  it("returns the EARLIER of endDate and contractEndDate when both set", () => {
    expect(
      getEffectiveDeadline({
        endDate: d("2026-06-12"),
        contractEndDate: d("2026-04-01"),
      })?.toISOString(),
    ).toBe(d("2026-04-01").toISOString());
  });

  it("returns the EARLIER of endDate and contractEndDate when project is earlier", () => {
    expect(
      getEffectiveDeadline({
        endDate: d("2026-03-15"),
        contractEndDate: d("2026-05-30"),
      })?.toISOString(),
    ).toBe(d("2026-03-15").toISOString());
  });

  it("returns the earliest across all three sources", () => {
    // endDate: future, contractEndDate: future, contract.endDate: past
    // → must pick contract.endDate (the binding one)
    expect(
      getEffectiveDeadline({
        endDate: d("2026-07-01"),
        contractEndDate: d("2026-06-01"),
        contract: { endDate: d("2026-03-01") },
      })?.toISOString(),
    ).toBe(d("2026-03-01").toISOString());
  });

  it("returns null when every source is null/undefined", () => {
    expect(getEffectiveDeadline({})).toBeNull();
    expect(
      getEffectiveDeadline({
        endDate: null,
        contractEndDate: null,
        contract: { endDate: null },
      }),
    ).toBeNull();
  });

  it("ignores invalid date strings", () => {
    expect(
      getEffectiveDeadline({
        endDate: "not-a-date",
        contractEndDate: d("2026-04-01"),
      })?.toISOString(),
    ).toBe(d("2026-04-01").toISOString());
  });

  it("accepts ISO strings interchangeably with Date objects", () => {
    expect(
      getEffectiveDeadline({
        endDate: "2026-06-12T00:00:00Z",
        contractEndDate: "2026-04-01T00:00:00Z",
      })?.toISOString(),
    ).toBe(d("2026-04-01").toISOString());
  });
});

describe("isProjectOverdue", () => {
  const NOW = d("2026-04-26").getTime();

  it("is false when no deadline is set", () => {
    expect(isProjectOverdue({}, NOW)).toBe(false);
  });

  it("is true when contract.endDate is in the past, even if endDate is future", () => {
    // Production-mirror scenario: project's plan window was extended past
    // the contracted end. Earlier code missed this — the helper catches it.
    expect(
      isProjectOverdue(
        {
          endDate: d("2026-06-12"), // future
          contractEndDate: d("2026-04-01"), // past
        },
        NOW,
      ),
    ).toBe(true);
  });

  it("is false when all sources are in the future", () => {
    expect(
      isProjectOverdue(
        {
          endDate: d("2026-07-01"),
          contractEndDate: d("2026-06-01"),
        },
        NOW,
      ),
    ).toBe(false);
  });
});

describe("daysRemainingForProject", () => {
  const NOW = d("2026-04-26").getTime();

  it("returns 0 when no deadline", () => {
    expect(daysRemainingForProject({}, NOW)).toBe(0);
  });

  it("returns 0 (clamped, never negative) when overdue", () => {
    expect(
      daysRemainingForProject({ contractEndDate: d("2026-04-01") }, NOW),
    ).toBe(0);
  });

  it("returns whole-day count to the earliest deadline", () => {
    // 30 days from 2026-04-26 to 2026-05-26
    expect(
      daysRemainingForProject(
        {
          endDate: d("2026-07-01"), // 66 days
          contractEndDate: d("2026-05-26"), // 30 days  ← winner
        },
        NOW,
      ),
    ).toBe(30);
  });
});
