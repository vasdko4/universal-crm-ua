import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'
import { getConnectionString, sslForConnectionString, stripSslParams } from './config'

const rawConnectionString = getConnectionString()
// Decide SSL from the original URL, then strip libpq params to avoid pg's
// `sslmode` deprecation warning while keeping the same connection behavior.
const ssl = rawConnectionString ? sslForConnectionString(rawConnectionString) : false
const connectionString = rawConnectionString ? stripSslParams(rawConnectionString) : undefined

// Pool sizing for high concurrency. Under load, requests that can't get a
// connection wait up to `connectionTimeoutMillis` instead of failing instantly,
// and idle connections are recycled so we don't exhaust the DB's own limit.
// Tune via env to match the hosting plan (e.g. Neon pooler, a VPS Postgres).
const toInt = (v: string | undefined, fallback: number) => {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback
}

export const pool = new Pool({
  connectionString,
  // Local Postgres (OSPanel/Docker) has no SSL; managed providers require it.
  ssl,
  // Max concurrent connections held by this instance's pool.
  max: toInt(process.env.DB_POOL_MAX, 20),
  // Close a connection after it sits idle this long (ms).
  idleTimeoutMillis: toInt(process.env.DB_POOL_IDLE_MS, 30_000),
  // Wait this long for a free connection before erroring (ms).
  connectionTimeoutMillis: toInt(process.env.DB_POOL_CONNECT_MS, 10_000),
  // Recycle a connection after this many queries to avoid long-lived leaks.
  maxUses: toInt(process.env.DB_POOL_MAX_USES, 7_500),
  keepAlive: true,
})

// Never let an unexpected idle-client error crash the whole process.
pool.on('error', (err) => {
  console.error('[db] idle pool client error:', err.message)
})

// Pooled providers (Neon pgbouncer etc.) can hand out connections with a
// stale search_path from a previous session, making unqualified table names
// fail with "relation does not exist". Pin it to public on new connections.
//
// Implementation history (do not "simplify" this back):
// - `options: '-c search_path=public'` startup parameter: broke production
//   entirely — Neon's pooled endpoint rejects arbitrary startup options.
// - `pool.on('connect', client => client.query(...))`: worked, but raced with
//   the first real query on the same client, spamming every Vercel log with
//   "(node:4) DeprecationWarning: Calling client.query() when the client is
//   already executing a query" (removal slated for pg@9).
// Current approach: wrap pool.connect() so the SET completes BEFORE the
// client is handed to the caller. A WeakSet skips clients that were already
// initialized, so reused pool connections pay no extra round-trip.
const initializedClients = new WeakSet<object>()

async function initClient(client: import('pg').PoolClient): Promise<void> {
  if (initializedClients.has(client)) return
  try {
    await client.query('SET search_path TO public')
    initializedClients.add(client)
  } catch (err) {
    console.error('[db] failed to set search_path:', (err as Error).message)
  }
}

const originalConnect = pool.connect.bind(pool) as () => Promise<import('pg').PoolClient>

// Support both call styles: pg's own pool.query() uses the callback form,
// drizzle/manual code uses the promise form.
;(pool as Pool).connect = ((cb?: (err: Error | undefined, client: import('pg').PoolClient | undefined, done: (release?: Error | boolean) => void) => void) => {
  if (typeof cb === 'function') {
    originalConnect().then(
      (client) => {
        void initClient(client).then(() =>
          cb(undefined, client, (release?: Error | boolean) => client.release(release)),
        )
      },
      (err: Error) => cb(err, undefined, () => {}),
    )
    return undefined
  }
  return originalConnect().then(async (client) => {
    await initClient(client)
    return client
  })
}) as Pool['connect']

export const db = drizzle(pool, { schema })
