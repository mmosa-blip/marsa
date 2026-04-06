/**
 * Locale-safe formatting helpers.
 * Uses "ar-SA-u-nu-latn" to get Arabic month/day names with Western (0-9) numerals,
 * preventing Next.js hydration mismatches between server and client.
 */

const LOCALE = "ar-SA-u-nu-latn";

// Default includes time so pages get "date + time" automatically.
// Pass a custom opts object to override (e.g. month/day-only shorthand).
export function formatDate(
  d: string | Date,
  opts: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }
) {
  return new Date(d).toLocaleDateString(LOCALE, opts);
}

export const formatDateTime = formatDate;

// Date-only variant for the rare cases where time would be noise
// (PDF receipts, calendar headers, etc).
export function formatDateOnly(d: string | Date) {
  return new Date(d).toLocaleDateString(LOCALE, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatNumber(n: number) {
  return n.toLocaleString(LOCALE);
}

export function formatCurrency(n: number) {
  return n.toLocaleString("en-US");
}
