import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
// Structural tests compare source text with LF literals; normalize so the
// file also passes on a Windows CRLF checkout.
const source = (file: string) => readFileSync(resolve(root, file), 'utf8').replace(/\r\n/g, '\n')

describe('audit P1 (3.4.96): "Today" is today only', () => {
  const analytics = source('app/actions/analytics.ts')

  it('kyivWindowStart subtracts (days - 1), not days', () => {
    // The window covers exactly `days` calendar days INCLUDING today:
    // days=1 starts at today's Kyiv midnight, not yesterday's.
    expect(analytics).toContain("(${daysParam}::int - 1) || ' days'")
    // The old shape must be gone from the function — the previous-window
    // expressions legitimately still use ($1 || ' days'), but the window
    // start itself must not.
    const fn = analytics.slice(
      analytics.indexOf('function kyivWindowStart'),
      analytics.indexOf('function kyivWindowStart') + 600,
    )
    expect(fn).not.toContain("(${daysParam} || ' days')")
  })

  it('the window-start arithmetic exists exactly once (single source of truth)', () => {
    // The two inline copies (getTimeseries bounds CTE, getRevenueTimeseries
    // generate_series) used to duplicate this subtraction and drifted by
    // the same off-by-one; both now call kyivWindowStart().
    const matches = analytics.match(
      /date_trunc\('day', NOW\(\) AT TIME ZONE 'Europe\/Kyiv'\) - \(/g,
    )
    expect(matches).toHaveLength(1)
  })

  it('getTimeseries bounds CTE uses kyivWindowStart', () => {
    expect(analytics).toContain("SELECT ${kyivWindowStart('$1')} AS start_ts")
  })

  it('getRevenueTimeseries generate_series starts at kyivWindowStart', () => {
    expect(analytics).toContain(
      "date_trunc('day', (${kyivWindowStart('$1')}) AT TIME ZONE 'Europe/Kyiv')",
    )
  })

  it('the previous-period window still derives from kyivWindowStart (no separate fix)', () => {
    // [start - N days, start) — fixing the start fixes the comparison
    // automatically; the expression itself needs no change.
    expect(analytics).toContain("(${kyivWindowStart('$1')} - ($1 || ' days')::interval)")
  })
})

// Live tests evaluate the SHIPPED kyivWindowStart SQL (extracted from the
// source at runtime, so a drifted copy would fail) against a real Postgres.
// Same probe pattern as tests/db-restore-backup.test.ts: only tables this
// file needs (none — pure SQL evaluation), skip when no server answers.
const TEST_DB_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/postgres'

type PgPool = {
  query: (text: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>
  end: () => Promise<void>
}
let PoolCtor: (new (opts: { connectionString: string; connectionTimeoutMillis?: number }) => PgPool) | null = null
let dbAvailable = false
try {
  const pg = await import('pg')
  PoolCtor = pg.Pool as unknown as typeof PoolCtor
  const probe = new pg.Pool({ connectionString: TEST_DB_URL, connectionTimeoutMillis: 2000 })
  await probe.query('SELECT 1')
  await probe.end()
  dbAvailable = true
} catch {
  dbAvailable = false
}
const describeDb = dbAvailable ? describe : describe.skip

describeDb('audit P1 (3.4.96): kyivWindowStart live against Postgres', () => {
  const analytics = source('app/actions/analytics.ts')
  // Extract the shipped expression template from the function source and
  // substitute the day count — the test runs the real SQL, not a copy.
  const match = analytics.match(
    /function kyivWindowStart\(daysParam: string\): string \{\n  return `([^`]+)`\n\}/,
  )
  if (!match) throw new Error('kyivWindowStart not found in app/actions/analytics.ts')
  const template = match[1]
  const expr = (days: number) => template.replace(/\$\{daysParam\}/g, String(days))

  let pool: PgPool
  beforeAll(async () => {
    pool = new PoolCtor!({ connectionString: TEST_DB_URL })
  })
  afterAll(async () => {
    await pool.end()
  })

  it('days=1 starts at Kyiv midnight today', async () => {
    const { rows } = await pool.query(
      `SELECT (${expr(1)}) = ((date_trunc('day', NOW() AT TIME ZONE 'Europe/Kyiv')) AT TIME ZONE 'Europe/Kyiv') AS ok`,
    )
    expect(rows[0].ok).toBe(true)
  })

  it('days=7 starts 6 days ago, days=30 starts 29 days ago', async () => {
    const { rows } = await pool.query(
      `SELECT (${expr(7)}) = ((date_trunc('day', NOW() AT TIME ZONE 'Europe/Kyiv') - interval '6 days') AT TIME ZONE 'Europe/Kyiv') AS d7,
              (${expr(30)}) = ((date_trunc('day', NOW() AT TIME ZONE 'Europe/Kyiv') - interval '29 days') AT TIME ZONE 'Europe/Kyiv') AS d30`,
    )
    expect(rows[0].d7).toBe(true)
    expect(rows[0].d30).toBe(true)
  })

  it('the chart series has exactly N dates (1/7/30), not N+1', async () => {
    for (const n of [1, 7, 30]) {
      const { rows } = await pool.query(
        `SELECT COUNT(*)::int AS c FROM generate_series(
           date_trunc('day', (${expr(n)}) AT TIME ZONE 'Europe/Kyiv'),
           date_trunc('day', NOW() AT TIME ZONE 'Europe/Kyiv'),
           '1 day')`,
      )
      expect(rows[0].c).toBe(n)
    }
  })

  it('Europe/Kyiv boundary: 23:30 yesterday is out, 00:30 today is in', async () => {
    const { rows } = await pool.query(
      `WITH s AS (SELECT (${expr(1)}) AS start_ts)
       SELECT
         ((date_trunc('day', NOW() AT TIME ZONE 'Europe/Kyiv') - interval '1 day' + interval '23 hours 30 minutes') AT TIME ZONE 'Europe/Kyiv') < start_ts AS late_yesterday_excluded,
         ((date_trunc('day', NOW() AT TIME ZONE 'Europe/Kyiv') + interval '30 minutes') AT TIME ZONE 'Europe/Kyiv') >= start_ts AS early_today_included
       FROM s`,
    )
    expect(rows[0].late_yesterday_excluded).toBe(true)
    expect(rows[0].early_today_included).toBe(true)
  })

  it('the previous window is exactly N days ending at the corrected start', async () => {
    const { rows } = await pool.query(
      `SELECT ((${expr(7)}) - interval '7 days') = ((date_trunc('day', NOW() AT TIME ZONE 'Europe/Kyiv') - interval '13 days') AT TIME ZONE 'Europe/Kyiv') AS ok`,
    )
    expect(rows[0].ok).toBe(true)
  })
})
