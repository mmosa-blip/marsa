/**
 * Locale-safe formatting helpers.
 * Uses "ar-SA-u-nu-latn" to get Arabic month/day names with Western (0-9) numerals,
 * preventing Next.js hydration mismatches between server and client.
 */

const LOCALE = "ar-SA-u-nu-latn";

export function formatDate(
  d: string | Date,
  opts: Intl.DateTimeFormatOptions = { year: "numeric", month: "short", day: "numeric" }
) {
  return new Date(d).toLocaleDateString(LOCALE, opts);
}

export function formatDateTime(d: string | Date) {
  return new Date(d).toLocaleDateString(LOCALE, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatNumber(n: number) {
  return n.toLocaleString(LOCALE);
}

export function formatCurrency(n: number) {
  return n.toLocaleString("en-US");
}
