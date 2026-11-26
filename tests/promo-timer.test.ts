import { describe, it, expect } from 'vitest'
import { formatRemaining } from '@/components/shop/promo-timer'

// Pure-function tests for formatRemaining only (no component rendering:
// the vitest environment is node, without jsdom/@testing-library).
const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR
const at = (days: number, h = 0, m = 0, s = 0) => days * DAY + h * HOUR + m * 60 * 1000 + s * 1000

describe('formatRemaining', () => {
  describe('under 24h — "HH:MM:SS" unchanged', () => {
    it('formats zero as 00:00:00', () => {
      expect(formatRemaining(0)).toBe('00:00:00')
    })

    it('formats 1h 2m 3s as 01:02:03', () => {
      expect(formatRemaining(at(0, 1, 2, 3))).toBe('01:02:03')
    })

    it('formats 23:59:59 just below the day boundary', () => {
      expect(formatRemaining(at(0, 23, 59, 59))).toBe('23:59:59')
    })
  })

  describe('24h and above — "N <day-word> HH:MM:SS" with hours 00–23', () => {
    it('formats exactly 24h as "1 день 00:00:00"', () => {
      expect(formatRemaining(DAY)).toBe('1 день 00:00:00')
    })

    it('splits 2 days 14:32:10 instead of accumulating hours (215:32:10)', () => {
      expect(formatRemaining(at(2, 14, 32, 10))).toBe('2 дні 14:32:10')
    })

    it('formats 21 days with the singular "день"', () => {
      expect(formatRemaining(at(21))).toBe('21 день 00:00:00')
    })

    it('formats 25 days with the genitive plural "днів"', () => {
      expect(formatRemaining(at(25))).toBe('25 днів 00:00:00')
    })

    it('formats 101 days with the singular "день"', () => {
      expect(formatRemaining(at(101))).toBe('101 день 00:00:00')
    })
  })

  describe('uk pluralization of the day word', () => {
    it('3 days → "3 дні"', () => {
      expect(formatRemaining(at(3))).toBe('3 дні 00:00:00')
    })

    it('4 days → "4 дні"', () => {
      expect(formatRemaining(at(4))).toBe('4 дні 00:00:00')
    })

    it('5 days → "5 днів"', () => {
      expect(formatRemaining(at(5))).toBe('5 днів 00:00:00')
    })

    it('11 days → "11 днів" (11–14 take the genitive plural)', () => {
      expect(formatRemaining(at(11))).toBe('11 днів 00:00:00')
    })

    it('14 days → "14 днів" (11–14 take the genitive plural)', () => {
      expect(formatRemaining(at(14))).toBe('14 днів 00:00:00')
    })
  })

  describe('ru pluralization of the day word', () => {
    it('1 day → "1 день"', () => {
      expect(formatRemaining(DAY, 'ru')).toBe('1 день 00:00:00')
    })

    it('2 days → "2 дня"', () => {
      expect(formatRemaining(at(2), 'ru')).toBe('2 дня 00:00:00')
    })

    it('5 days → "5 дней"', () => {
      expect(formatRemaining(at(5), 'ru')).toBe('5 дней 00:00:00')
    })

    it('12 days → "12 дней" (11–14 take the genitive plural)', () => {
      expect(formatRemaining(at(12), 'ru')).toBe('12 дней 00:00:00')
    })
  })

  describe('defaults and edge cases', () => {
    it('defaults to the uk day word when no locale is passed', () => {
      expect(formatRemaining(at(2))).toBe('2 дні 00:00:00')
    })

    it('clamps negative values to 00:00:00', () => {
      expect(formatRemaining(-1000)).toBe('00:00:00')
    })
  })
})
