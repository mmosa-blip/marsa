/**
 * Working-days calculator for Marsa.
 *
 * The Saudi work week here is 6 days: Sunday → Friday.
 * Saturday (JavaScript getDay() === 6) is the only weekend day.
 *
 * These helpers exist so every project / service / task scheduler in
 * the codebase shares one definition of "add N days to this date".
 * Before this lived in a single file, six different routes used naive
 * `date.setDate(date.getDate() + N)` calls that counted Saturdays as
 * working days, which made every project end date 1 day too short per
 * Saturday in the range.
 */

/**
 * Add `days` working days (Sun–Fri, skipping Saturdays) to `startDate`
 * and return a NEW Date. The input is never mutated.
 *
 * `days <= 0` returns a clone of `startDate` unchanged.
 */
export function addWorkingDays(startDate: Date, days: number): Date {
  if (days <= 0) return new Date(startDate);
  const date = new Date(startDate);
  let added = 0;
  while (added < days) {
    date.setDate(date.getDate() + 1);
    // Saturday = 6 → weekend, every other day counts
    if (date.getDay() !== 6) {
      added++;
    }
  }
  return date;
}

/**
 * Count working days strictly between `start` (exclusive) and `end`
 * (inclusive). Symmetric inverse of `addWorkingDays` — useful for
 * back-computing how long an actual span took once dates land.
 */
export function countWorkingDays(start: Date, end: Date): number {
  let count = 0;
  const d = new Date(start);
  while (d < end) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 6) count++;
  }
  return count;
}
