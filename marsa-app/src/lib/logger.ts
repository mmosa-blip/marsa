/**
 * Centralized logger. Replaces the ~187 scattered `console.log` calls
 * with a thin wrapper that:
 *   - tags every line with a level prefix (searchable in Vercel logs)
 *   - silences `info` / `debug` in production (they only surface in dev)
 *   - always emits `warn` and `error` so real incidents stay visible
 *
 * Usage:
 *   import { logger } from "@/lib/logger";
 *   logger.info("request accepted", { userId });
 *   logger.error("db write failed", err, { taskId });
 *
 * We intentionally stay on top of `console.*` rather than pulling in
 * pino/winston: Next.js Edge + Node runtimes share console, the bundle
 * footprint stays zero, and Vercel already captures stdout/stderr.
 */

type Meta = Record<string, unknown> | undefined;

const isDev = process.env.NODE_ENV !== "production";

class Logger {
  info(message: string, meta?: Meta) {
    if (isDev) {
      // eslint-disable-next-line no-console
      console.log(`[INFO] ${message}`, meta ?? "");
    }
  }

  warn(message: string, meta?: Meta) {
    // eslint-disable-next-line no-console
    console.warn(`[WARN] ${message}`, meta ?? "");
  }

  error(message: string, error?: unknown, meta?: Meta) {
    const errMeta =
      error instanceof Error
        ? { name: error.name, message: error.message, stack: error.stack }
        : { error };
    // eslint-disable-next-line no-console
    console.error(`[ERROR] ${message}`, { ...errMeta, ...(meta ?? {}) });
  }

  debug(message: string, meta?: Meta) {
    if (isDev) {
      // eslint-disable-next-line no-console
      console.debug(`[DEBUG] ${message}`, meta ?? "");
    }
  }
}

export const logger = new Logger();
