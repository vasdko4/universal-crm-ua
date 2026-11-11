import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

// product-slug.ts touches the DB module — stub it like stock-ledger.test.ts
// does; withSlugRetry itself is pure retry logic and needs no live DB.
vi.mock('@/lib/db', () => ({
  db: {},
  dbForClient: vi.fn(),
  withDbClient: vi.fn(),
}))

import {
  ADMIN_MAX_LEN,
  MONEY_10_2_MAX,
  adminStringTooLong,
  isAdminNumberInRange,
  parseAdminNumber,
} from '@/lib/shop/checkout-validation'
import { SLUG_RETRY_ATTEMPTS, withSlugRetry } from '@/lib/product-slug'

const root = resolve(import.meta.dirname, '..')
const source = (file: string) => readFileSync(resolve(root, file), 'utf8')

function uniqueViolation(message = 'duplicate key value violates unique constraint') {
  return Object.assign(new Error(message), { code: '23505' })
}

describe('parseAdminNumber', () => {
  it('accepts numbers and numeric strings (comma decimal allowed)', () => {
    expect(parseAdminNumber(42)).toBe(42)
    expect(parseAdminNumber('70,5')).toBe(70.5)
    expect(parseAdminNumber(' 80 ')).toBe(80)
    expect(parseAdminNumber('0')).toBe(0)
  })

  it('rejects NaN, Infinity and junk instead of letting Postgres 500', () => {
    expect(parseAdminNumber(NaN)).toBeNull()
    expect(parseAdminNumber(Infinity)).toBeNull()
    expect(parseAdminNumber(-Infinity)).toBeNull()
    expect(parseAdminNumber('Infinity')).toBeNull()
    expect(parseAdminNumber('abc')).toBeNull()
    expect(parseAdminNumber('')).toBeNull()
    expect(parseAdminNumber(null)).toBeNull()
    expect(parseAdminNumber(undefined)).toBeNull()
  })
})

describe('isAdminNumberInRange', () => {
  it('enforces the numeric(10,2) ceiling', () => {
    expect(isAdminNumberInRange(99999999.99, 0, MONEY_10_2_MAX)).toBe(true)
    expect(isAdminNumberInRange(100000000, 0, MONEY_10_2_MAX)).toBe(false)
    expect(isAdminNumberInRange(-1, 0, MONEY_10_2_MAX)).toBe(false)
    expect(isAdminNumberInRange('Infinity', 0, MONEY_10_2_MAX)).toBe(false)
    expect(isAdminNumberInRange(NaN, 0, MONEY_10_2_MAX)).toBe(false)
  })
})

describe('adminStringTooLong', () => {
  it('flags strings over the column length after trimming', () => {
    expect(adminStringTooLong('x'.repeat(ADMIN_MAX_LEN.productName), ADMIN_MAX_LEN.productName)).toBe(false)
    expect(adminStringTooLong('x'.repeat(ADMIN_MAX_LEN.productName + 1), ADMIN_MAX_LEN.productName)).toBe(true)
    expect(adminStringTooLong(null, ADMIN_MAX_LEN.productName)).toBe(false)
  })
})

describe('withSlugRetry', () => {
  it('returns the first slug when the attempt succeeds', async () => {
    const { result, slug } = await withSlugRetry('test', async (s) => `ok-${s}`)
    expect(result).toBe('ok-test')
    expect(slug).toBe('test')
  })

  it('retries with an incremented suffix on 23505', async () => {
    let calls = 0
    const { result, slug } = await withSlugRetry('test', async (s) => {
      calls += 1
      if (calls === 1) throw uniqueViolation()
      return `ok-${s}`
    })
    expect(calls).toBe(2)
    expect(slug).toBe('test-2')
    expect(result).toBe('ok-test-2')
  })

  it('rethrows non-unique errors immediately without retrying', async () => {
    let calls = 0
    await expect(
      withSlugRetry('test', async () => {
        calls += 1
        throw new Error('boom')
      }),
    ).rejects.toThrow('boom')
    expect(calls).toBe(1)
  })

  it('gives up after SLUG_RETRY_ATTEMPTS tries', async () => {
    let calls = 0
    await expect(
      withSlugRetry('test', async () => {
        calls += 1
        throw uniqueViolation()
      }),
    ).rejects.toThrow('duplicate key')
    expect(calls).toBe(SLUG_RETRY_ATTEMPTS)
  })
})

describe('catalog 3.4.89 structural checks', () => {
  it('feed: variant offers never fall back to the parent oldPrice', () => {
    const feed = source('lib/shop/google-merchant-feed.ts')
    expect(feed).toContain('oldPrice: v.oldPrice && v.oldPrice > price ? v.oldPrice : null')
    expect(feed).not.toContain('v.oldPrice : p.oldPrice')
  })

  it('products: create/update retry slugs and lock the row', () => {
    const products = source('app/actions/products.ts')
    expect(products.match(/withSlugRetry\(firstSlug/g)).toHaveLength(3)
    expect(products).toContain('.for(\'update\')')
    expect(products).toContain('UnknownRelationError')
    expect(products).toContain('.for(\'share\')')
    expect(products).toContain('Категорії не знайдено')
    expect(products).toContain('Групи не знайдено')
    expect(products).toContain('MONEY_10_2_MAX')
    expect(products).toContain('MONEY_10_3_MAX')
  })

  it('products: stock is set absolutely in one statement (no stale-read delta)', () => {
    const products = source('app/actions/products.ts')
    expect(products).not.toContain('bulkAdjustProductStock([id], delta,')
    expect(products).toContain('WITH target AS')
    expect(products).toContain('qty_before')
    expect(products).toContain('Категорію #${categoryId} не знайдено')
  })

  it('categories: unique slugs with retry + locked update', () => {
    const categories = source('app/actions/categories.ts')
    expect(categories).toContain('generateUniqueCategorySlug')
    expect(categories).toContain('withSlugRetry(firstSlug')
    expect(categories).toContain('.for(\'update\')')
    const schema = source('lib/db/schema.ts')
    const block = schema.slice(schema.indexOf('export const categories'), schema.indexOf('export const productCategory'))
    expect(block).toContain('.unique()')
    const migrate = source('db/migrate.sql')
    expect(migrate).toContain('idx_categories_slug')
    expect(migrate).toContain('DO $$')
  })

  it('groups: delete refuses when promotions target the group', () => {
    const groups = source('app/actions/groups.ts')
    expect(groups).toContain('Группа используется в акциях')
    expect(groups).toContain('targetGroupIds} @>')
  })

  it('promotions: minOrderAmount, fixed cap and date order are validated', () => {
    const promotions = source('app/actions/promotions.ts')
    expect(promotions).toContain('Минимальная сумма заказа должна быть числом')
    expect(promotions).toContain('MONEY_12_2_MAX')
    expect(promotions).toContain('Дата окончания раньше даты начала')
  })

  it('settings: the write locks the row instead of merging a cached read', () => {
    const settings = source('app/actions/settings-store.ts')
    expect(settings).toContain('FOR UPDATE')
    expect(settings).toContain('normalizeStoreSettingsRow(rows[0]')
  })

  it('pages/articles: create/update retry on 23505', () => {
    for (const file of ['app/actions/pages.ts', 'app/actions/articles.ts']) {
      const src = source(file)
      expect(src).toContain('withSlugRetry(firstSlug')
    }
  })

  it('product page: related products are LIMITed and reviews/questions capped', () => {
    const queries = source('lib/shop/queries.ts')
    expect(queries).not.toContain('const related = await db')
    expect(queries).toContain('.limit(limit)')
    expect(queries.match(/\.limit\(100\)/g)).toHaveLength(2)
  })
})
