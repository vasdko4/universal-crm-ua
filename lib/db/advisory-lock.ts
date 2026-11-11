import { pool } from '@/lib/db'
import type { PoolClient } from 'pg'

/**
 * Distributed lock for the in-process schedulers (Prom sync, cron jobs).
 *
 * The in-process `running` flags only guard one Node process; the store can
 * run several instances (deploys, restarts, scale-out), and two of them
 * would happily run the same job at once. A Postgres session-level advisory
 * lock is visible to every instance: the holder runs the job, everyone else
 * skips the tick.
 *
 * The lock is held on a dedicated pool client for the whole job, then
 * released (unlock + client release). The key is namespaced per scheduler
 * family so different jobs never block each other.
 */
export type AdvisoryLock = {
  release: () => Promise<void>
}

export async function tryAdvisoryLock(namespace: number, key: string): Promise<AdvisoryLock | null> {
  const client: PoolClient = await pool.connect()
  try {
    const { rows } = await client.query<{ locked: boolean }>(
      `SELECT pg_try_advisory_lock($1, hashtext($2)) AS locked`,
      [namespace, key],
    )
    if (!rows[0]?.locked) {
      client.release()
      return null
    }
    let released = false
    return {
      release: async () => {
        if (released) return
        released = true
        try {
          await client.query(`SELECT pg_advisory_unlock($1, hashtext($2))`, [namespace, key])
        } catch {
          // The session may already be gone; the lock dies with it.
        }
        client.release()
      },
    }
  } catch (e) {
    client.release()
    throw e
  }
}
