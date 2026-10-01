import { describe, it, expect } from 'vitest'
import { evaluateAnomalies, readAnomalyConfig, isDaytime, kyivHour, type AnomalyConfig } from '@/lib/analytics/anomaly'

const CONFIG: AnomalyConfig = {
  zeroOrderHours: 6,
  dayStartHour: 8,
  dayEndHour: 23,
  cancelSpikeMultiplier: 2,
  cancelSpikeMin: 5,
}

// 2026-10-01 12:00 CEST == 13:00 Kyiv (UTC+3 in October) — daytime.
const DAYTIME = new Date('2026-10-01T12:00:00+02:00')
// 2026-10-01 01:00 CEST == 02:00 Kyiv — night.
const NIGHT = new Date('2026-10-01T01:00:00+02:00')

describe('kyivHour', () => {
  it('reports the hour in Europe/Kyiv, not UTC', () => {
    // 12:00 CEST (UTC+2) == 13:00 Kyiv (UTC+3).
    expect(kyivHour(DAYTIME)).toBe(13)
    expect(kyivHour(NIGHT)).toBe(2)
  })
})

describe('isDaytime', () => {
  it('is true inside the configured window only', () => {
    expect(isDaytime(DAYTIME, CONFIG)).toBe(true)
    expect(isDaytime(NIGHT, CONFIG)).toBe(false)
  })
})

describe('readAnomalyConfig', () => {
  it('reads env overrides and falls back to defaults', () => {
    expect(readAnomalyConfig({})).toEqual(CONFIG)
    expect(
      readAnomalyConfig({
        ANOMALY_ZERO_ORDER_HOURS: '3',
        ANOMALY_DAY_START: '9',
        ANOMALY_DAY_END: '21',
        ANOMALY_CANCEL_SPIKE_MULTIPLIER: '3',
        ANOMALY_CANCEL_SPIKE_MIN: '10',
      }),
    ).toEqual({
      zeroOrderHours: 3,
      dayStartHour: 9,
      dayEndHour: 21,
      cancelSpikeMultiplier: 3,
      cancelSpikeMin: 10,
    })
  })

  it('ignores non-numeric env values', () => {
    expect(readAnomalyConfig({ ANOMALY_ZERO_ORDER_HOURS: 'abc' }).zeroOrderHours).toBe(6)
  })
})

describe('evaluateAnomalies', () => {
  const base = {
    now: DAYTIME,
    ordersLastNHours: 4,
    cancelsLast24h: 1,
    baselineDailyCancels: 1,
    config: CONFIG,
  }

  it('alerts on zero orders during the day', () => {
    const alerts = evaluateAnomalies({ ...base, ordersLastNHours: 0 })
    expect(alerts).toHaveLength(1)
    expect(alerts[0].kind).toBe('zero_orders')
  })

  it('stays quiet on zero orders at night', () => {
    const alerts = evaluateAnomalies({ ...base, now: NIGHT, ordersLastNHours: 0 })
    expect(alerts).toHaveLength(0)
  })

  it('alerts on a cancellation spike vs the baseline', () => {
    const alerts = evaluateAnomalies({ ...base, cancelsLast24h: 8, baselineDailyCancels: 2 })
    expect(alerts.some((a) => a.kind === 'cancel_spike')).toBe(true)
  })

  it('requires both the absolute floor and the relative jump', () => {
    // Below the absolute floor — no alert even with a huge relative jump.
    expect(evaluateAnomalies({ ...base, cancelsLast24h: 4, baselineDailyCancels: 0 })).toHaveLength(0)
    // Below the relative jump — no alert even above the floor.
    expect(
      evaluateAnomalies({ ...base, cancelsLast24h: 6, baselineDailyCancels: 5 }),
    ).toHaveLength(0)
  })

  it('alerts on a spike from a zero baseline once the floor is reached', () => {
    const alerts = evaluateAnomalies({ ...base, cancelsLast24h: 5, baselineDailyCancels: 0 })
    expect(alerts.some((a) => a.kind === 'cancel_spike')).toBe(true)
  })

  it('can fire both alerts at once', () => {
    const alerts = evaluateAnomalies({
      ...base,
      ordersLastNHours: 0,
      cancelsLast24h: 10,
      baselineDailyCancels: 1,
    })
    expect(alerts.map((a) => a.kind).sort()).toEqual(['cancel_spike', 'zero_orders'])
  })

  it('stays quiet on a healthy shop', () => {
    expect(evaluateAnomalies(base)).toHaveLength(0)
  })
})
