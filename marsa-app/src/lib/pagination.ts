/**
 * URL-driven pagination helpers. Route handlers wire these in as:
 *
 *   const url = new URL(request.url);
 *   const { take, skip, page } = parsePagination(url);
 *   const [data, total] = await Promise.all([
 *     prisma.x.findMany({ take, skip, ... }),
 *     prisma.x.count({ where }),
 *   ]);
 *   return withPaginationHeaders(NextResponse.json(data), paginationMeta(total, page, take));
 *
 * Backward-compat note: existing listing endpoints return arrays
 * directly and their UI consumers call `.map()` on the result. Wrapping
 * the body in `{ data, pagination }` would break every consumer. The
 * helpers expose both shapes — handlers keep returning an array and use
 * `X-Total-Count` / `X-Page` / `X-Pages` headers to surface metadata
 * without a body change.
 */

import type { NextResponse } from "next/server";

const DEFAULT_TAKE = 50;
const MAX_TAKE = 200;

function parsePositiveInt(raw: string | null, fallback: number): number {
  const n = parseInt(raw || "", 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function parsePagination(url: URL, defaultTake = DEFAULT_TAKE, maxTake = MAX_TAKE) {
  const page = parsePositiveInt(url.searchParams.get("page"), 1);
  const requestedTake = parsePositiveInt(url.searchParams.get("take"), defaultTake);
  const take = Math.min(maxTake, requestedTake);
  const skip = (page - 1) * take;
  return { page, take, skip };
}

export interface PaginationMeta {
  total: number;
  page: number;
  take: number;
  pages: number;
  hasMore: boolean;
}

export function paginationMeta(total: number, page: number, take: number): PaginationMeta {
  const pages = take > 0 ? Math.ceil(total / take) : 0;
  return {
    total,
    page,
    take,
    pages,
    hasMore: page * take < total,
  };
}

// Attach pagination metadata as response headers. Callers keep returning
// the array body so existing UI code continues to work; new callers can
// opt into headers for pagination controls.
export function withPaginationHeaders<T extends NextResponse>(
  response: T,
  meta: PaginationMeta
): T {
  response.headers.set("X-Total-Count", String(meta.total));
  response.headers.set("X-Page", String(meta.page));
  response.headers.set("X-Pages", String(meta.pages));
  response.headers.set("X-Take", String(meta.take));
  return response;
}
