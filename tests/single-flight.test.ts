import { describe, it, expect } from 'vitest'
import { singleFlight } from '@/lib/cache/single-flight'

const tick = () => new Promise((r) => setTimeout(r, 5))

describe('singleFlight', () => {
  it('runs the work once for concurrent identical calls', async () => {
    let calls = 0
    const work = () => {
      calls++
      return tick().then(() => 'done')
    }
    const results = await Promise.all([
      singleFlight('k1', work),
      singleFlight('k1', work),
      singleFlight('k1', work),
    ])
    expect(results).toEqual(['done', 'done', 'done'])
    expect(calls).toBe(1)
  })

  it('does not dedupe different keys', async () => {
    let calls = 0
    const work = () => {
      calls++
      return tick().then(() => calls)
    }
    await Promise.all([singleFlight('a', work), singleFlight('b', work)])
    expect(calls).toBe(2)
  })

  it('runs again after the first call settles (no stale dedupe)', async () => {
    let calls = 0
    const work = () => {
      calls++
      return tick().then(() => calls)
    }
    await singleFlight('k2', work)
    await singleFlight('k2', work)
    expect(calls).toBe(2)
  })

  it('propagates rejection to all waiters and clears the slot', async () => {
    let calls = 0
    const boom = () => {
      calls++
      return tick().then(() => {
        throw new Error('nope')
      })
    }
    const results = await Promise.allSettled([singleFlight('k3', boom), singleFlight('k3', boom)])
    expect(calls).toBe(1)
    expect(results.every((r) => r.status === 'rejected')).toBe(true)
    // slot cleared: next call retries the work
    await expect(singleFlight('k3', () => tick().then(() => 'ok'))).resolves.toBe('ok')
  })
})
