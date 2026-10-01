/**
 * ROAS report math: campaign (source/medium/campaign, last-touch from
 * orders.utm_*) -> orders -> revenue -> ROAS.
 *
 * Revenue comes from real paid/fulfilled orders (see getCampaignReport in
 * app/actions/analytics.ts). Spend is entered manually in the report UI and
 * kept in store_settings.ads_spend — ad platforms are not connected, so
 * there is no automatic spend source. All math lives here so it is
 * unit-testable without a database.
 */

import type { AdsSpendEntry } from '@/lib/store-settings-normalize'

export type CampaignReportRow = {
  source: string
  medium: string
  campaign: string
  orders: number
  revenue: number
  /** Manual ad spend (UAH) for this campaign, null when not entered. */
  spend: number | null
  /** revenue / spend. null when spend is missing or zero — not "infinite". */
  roas: number | null
}

/** Sentinel used in the DB query for orders with no utm_source. */
export const DIRECT_SOURCE_SENTINEL = '(direct)'

export function spendKey(source: string, medium: string, campaign: string): string {
  return `${source}\u0000${medium}\u0000${campaign}`
}

/**
 * ROAS = revenue / spend. Returns null when spend is unknown or zero —
 * reporting "infinite" ROAS for a campaign with unentered spend would be a
 * lie the dashboard should not print.
 */
export function calcRoas(revenue: number, spend: number | null): number | null {
  if (spend == null || !Number.isFinite(spend) || spend <= 0) return null
  if (!Number.isFinite(revenue) || revenue < 0) return null
  return revenue / spend
}

/**
 * Joins manual spend entries onto the DB rows. Spend is matched by the
 * (source, medium, campaign) triple; rows without a match keep spend=null.
 */
export function mergeSpendIntoReport(
  rows: Array<{ source: string; medium: string; campaign: string; orders: number; revenue: number }>,
  spendEntries: AdsSpendEntry[],
): CampaignReportRow[] {
  const spendByKey = new Map<string, number>()
  for (const e of spendEntries) {
    if (typeof e?.spend === 'number' && Number.isFinite(e.spend) && e.spend >= 0) {
      spendByKey.set(spendKey(e.source, e.medium, e.campaign), e.spend)
    }
  }
  return rows.map((r) => {
    const spend = spendByKey.get(spendKey(r.source, r.medium, r.campaign)) ?? null
    return { ...r, spend, roas: calcRoas(r.revenue, spend) }
  })
}

/**
 * Sanitizes the spend form payload before it is written to
 * store_settings.ads_spend. Invalid rows are dropped, not coerced — a typo
 * like "abc" must not become 0 and silently claim a campaign was free.
 * Duplicates collapse (last wins).
 */
export function validateSpendEntries(input: unknown): AdsSpendEntry[] {
  if (!Array.isArray(input)) return []
  const entries: AdsSpendEntry[] = []
  for (const raw of input) {
    if (typeof raw !== 'object' || raw === null) continue
    const r = raw as Record<string, unknown>
    const source = typeof r.source === 'string' ? r.source.trim().slice(0, 150) : ''
    const medium = typeof r.medium === 'string' ? r.medium.trim().slice(0, 150) : ''
    const campaign = typeof r.campaign === 'string' ? r.campaign.trim().slice(0, 150) : ''
    const spendNum = typeof r.spend === 'number' ? r.spend : Number(r.spend)
    if (!source || !Number.isFinite(spendNum) || spendNum < 0) continue
    const key = spendKey(source, medium, campaign)
    const entry = { source, medium, campaign, spend: Math.round(spendNum * 100) / 100 }
    const idx = entries.findIndex((e) => spendKey(e.source, e.medium, e.campaign) === key)
    if (idx >= 0) entries[idx] = entry
    else entries.push(entry)
  }
  return entries
}
