import { describe, it, expect } from "vitest";
import { computeServiceDuration, computeProjectDuration } from "../service-duration";

describe("computeServiceDuration", () => {
  it("sums SEQUENTIAL task durations", () => {
    const d = computeServiceDuration([
      { defaultDuration: 3, executionMode: "SEQUENTIAL", sameDay: false },
      { defaultDuration: 5, executionMode: "SEQUENTIAL", sameDay: false },
    ]);
    expect(d).toBe(8);
  });

  it("takes max of adjacent PARALLEL tasks", () => {
    const d = computeServiceDuration([
      { defaultDuration: 2, executionMode: "PARALLEL", sameDay: false },
      { defaultDuration: 7, executionMode: "PARALLEL", sameDay: false },
      { defaultDuration: 4, executionMode: "PARALLEL", sameDay: false },
    ]);
    expect(d).toBe(7);
  });

  it("flushes parallel group before each SEQUENTIAL", () => {
    const d = computeServiceDuration([
      { defaultDuration: 3, executionMode: "SEQUENTIAL", sameDay: false },
      { defaultDuration: 4, executionMode: "PARALLEL", sameDay: false },
      { defaultDuration: 6, executionMode: "PARALLEL", sameDay: false },
      { defaultDuration: 2, executionMode: "SEQUENTIAL", sameDay: false },
    ]);
    // 3 (seq) + 6 (max of parallel pair) + 2 (seq) = 11
    expect(d).toBe(11);
  });

  it("skips sameDay tasks", () => {
    const d = computeServiceDuration([
      { defaultDuration: 3, executionMode: "SEQUENTIAL", sameDay: true },
      { defaultDuration: 5, executionMode: "SEQUENTIAL", sameDay: false },
    ]);
    expect(d).toBe(5);
  });

  it("skips INDEPENDENT tasks", () => {
    const d = computeServiceDuration([
      { defaultDuration: 10, executionMode: "INDEPENDENT", sameDay: false },
      { defaultDuration: 4, executionMode: "SEQUENTIAL", sameDay: false },
    ]);
    expect(d).toBe(4);
  });

  it("returns at least 1 day for a service with only sameDay tasks", () => {
    const d = computeServiceDuration([
      { defaultDuration: 1, executionMode: "SEQUENTIAL", sameDay: true },
    ]);
    expect(d).toBe(1);
  });

  it("returns 0 for an empty task list", () => {
    expect(computeServiceDuration([])).toBe(0);
  });
});

describe("computeProjectDuration", () => {
  it("sums SEQUENTIAL services", () => {
    const d = computeProjectDuration([
      { duration: 10, executionMode: "SEQUENTIAL", isBackground: false },
      { duration: 5, executionMode: "SEQUENTIAL", isBackground: false },
    ]);
    expect(d).toBe(15);
  });

  it("takes max of adjacent PARALLEL services", () => {
    const d = computeProjectDuration([
      { duration: 3, executionMode: "PARALLEL", isBackground: false },
      { duration: 12, executionMode: "PARALLEL", isBackground: false },
      { duration: 7, executionMode: "PARALLEL", isBackground: false },
    ]);
    expect(d).toBe(12);
  });

  it("skips isBackground services", () => {
    const d = computeProjectDuration([
      { duration: 5, executionMode: "PARALLEL", isBackground: true },
      { duration: 10, executionMode: "SEQUENTIAL", isBackground: false },
    ]);
    expect(d).toBe(10);
  });

  it("skips INDEPENDENT services", () => {
    const d = computeProjectDuration([
      { duration: 99, executionMode: "INDEPENDENT", isBackground: false },
      { duration: 4, executionMode: "SEQUENTIAL", isBackground: false },
    ]);
    expect(d).toBe(4);
  });

  it("matches the FATIH HANLI critical path (56 working days)", () => {
    // Template configuration observed in production for
    // "مشروع تجاري - FATIH HANLI" after the Phase-1 data repair:
    //   [0] 18 SEQ
    //   [1]  4 SEQ
    //   [2]  5 PAR + isBackground=true  → skipped
    //   [3] 13 PAR
    //   [4] 12 PAR
    //   [5] 12 PAR
    //   [6]  9 SEQ
    //   [7]  8 SEQ
    //   [8]  4 SEQ
    // 18 + 4 + max(13,12,12) + 9 + 8 + 4 = 56
    const d = computeProjectDuration([
      { duration: 18, executionMode: "SEQUENTIAL", isBackground: false },
      { duration: 4, executionMode: "SEQUENTIAL", isBackground: false },
      { duration: 5, executionMode: "PARALLEL", isBackground: true },
      { duration: 13, executionMode: "PARALLEL", isBackground: false },
      { duration: 12, executionMode: "PARALLEL", isBackground: false },
      { duration: 12, executionMode: "PARALLEL", isBackground: false },
      { duration: 9, executionMode: "SEQUENTIAL", isBackground: false },
      { duration: 8, executionMode: "SEQUENTIAL", isBackground: false },
      { duration: 4, executionMode: "SEQUENTIAL", isBackground: false },
    ]);
    expect(d).toBe(56);
  });

  it("flushes trailing parallel group", () => {
    const d = computeProjectDuration([
      { duration: 2, executionMode: "SEQUENTIAL", isBackground: false },
      { duration: 6, executionMode: "PARALLEL", isBackground: false },
      { duration: 4, executionMode: "PARALLEL", isBackground: false },
    ]);
    // 2 (seq) + 6 (max of trailing parallel) = 8
    expect(d).toBe(8);
  });
});
