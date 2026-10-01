import { normPageParams } from '@/lib/api/helpers'

export type PaymentPageParams = { page?: number; pageSize?: number }

/**
 * Shared pagination contract for payment list actions. Clamps page/pageSize
 * through normPageParams — the same defaults (page 1, 10 per page) and the
 * same 1..100 bounds used by every other admin list — and derives the
 * offset/limit pair for the query.
 */
export function normalizePaymentPage(params: PaymentPageParams = {}) {
  const { page, pageSize } = normPageParams(params.page, params.pageSize)
  return { page, pageSize, offset: (page - 1) * pageSize, limit: pageSize }
}

/**
 * Total pages for a paginated list. Never less than 1 so the pager always
 * has a valid page to render, even for an empty list.
 */
export function totalPages(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(Math.max(0, total) / Math.max(1, pageSize)))
}
