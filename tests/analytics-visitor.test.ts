import { describe, expect, it } from 'vitest'
import { detectBot, botName, hashIp } from '@/lib/analytics/visitor'

describe('detectBot', () => {
  it('detects major search crawlers', () => {
    expect(detectBot('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)').isBot).toBe(true)
    expect(detectBot('Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)').isBot).toBe(true)
    expect(detectBot('Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)').isBot).toBe(true)
  })

  it('detects social preview fetchers and monitors', () => {
    expect(detectBot('facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)').isBot).toBe(true)
    expect(detectBot('TelegramBot (like TwitterBot)').isBot).toBe(true)
    expect(detectBot('UptimeRobot/2.0; http://www.uptimerobot.com/').isBot).toBe(true)
  })

  it('names known bots', () => {
    expect(botName('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)')).toBe('Googlebot')
    expect(botName('AhrefsBot/7.0; +http://ahrefs.com/robot/')).toBe('AhrefsBot')
  })

  it('does not flag real browsers', () => {
    const chrome =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
    expect(detectBot(chrome)).toEqual({ isBot: false, name: null })
    const safari =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
    expect(detectBot(safari).isBot).toBe(false)
  })

  it('handles empty user agents', () => {
    expect(detectBot(null).isBot).toBe(false)
    expect(detectBot('').isBot).toBe(false)
  })
})

describe('hashIp', () => {
  it('is stable and does not leak the raw IP', () => {
    const h1 = hashIp('203.0.113.7')
    const h2 = hashIp('203.0.113.7')
    expect(h1).toBe(h2)
    expect(h1).not.toContain('203.0.113.7')
    expect(h1).toHaveLength(64)
    expect(hashIp('203.0.113.8')).not.toBe(h1)
  })
})
