import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { getAdminDictionary } from '@/lib/i18n/admin/dictionaries'

const root = resolve(import.meta.dirname, '..')
// Structural tests compare source text with LF literals; normalize so the
// file also passes on a Windows CRLF checkout.
const source = (file: string) => readFileSync(resolve(root, file), 'utf8').replace(/\r\n/g, '\n')

describe('gaDoubleCountWarning dictionary entries (audit P2, 3.4.96)', () => {
  it('exists in uk and warns about double-counting with MP env vars set', () => {
    const s = getAdminDictionary('uk').settings.gaDoubleCountWarning
    expect(s).toContain('GA4_MEASUREMENT_ID')
    expect(s).toContain('GA4_API_SECRET')
    expect(s).toContain('двічі')
    expect(s).toContain('дедуплікації')
  })

  it('exists in ru and warns about double-counting with MP env vars set', () => {
    const s = getAdminDictionary('ru').settings.gaDoubleCountWarning
    expect(s).toContain('GA4_MEASUREMENT_ID')
    expect(s).toContain('GA4_API_SECRET')
    expect(s).toContain('дважды')
    expect(s).toContain('дедупликации')
  })
})

describe('ads-tab shows the warning next to the GA toggle', () => {
  it('renders the warning inside the GA block, after the GA hint', () => {
    const src = source('components/settings/ads-tab.tsx')
    expect(src).toContain('{t.gaDoubleCountWarning}')
    // Inside the GA block: after the GA title/hint, before the next
    // section (Merchant Center) starts.
    const gaTitleAt = src.indexOf('{t.gaTitle}')
    const warningAt = src.indexOf('{t.gaDoubleCountWarning}')
    const merchantAt = src.indexOf('{t.merchantTitle}')
    expect(gaTitleAt).toBeGreaterThan(-1)
    expect(warningAt).toBeGreaterThan(gaTitleAt)
    expect(merchantAt).toBeGreaterThan(warningAt)
  })

  it('styles the warning as a warning, not a plain hint', () => {
    const src = source('components/settings/ads-tab.tsx')
    const line = src.split('\n').find((l) => l.includes('{t.gaDoubleCountWarning}'))
    expect(line).toContain('text-amber-')
  })
})

describe('.env.example GA4 block carries the warning', () => {
  it('warns that enabling MP while the browser purchase is on double-counts', () => {
    const env = source('.env.example')
    const start = env.indexOf('Server-side GA4')
    const end = env.indexOf('# ──', start + 1)
    expect(start).toBeGreaterThan(-1)
    const block = env.slice(start, end === -1 ? undefined : end)
    expect(block).toContain('двічі')
    expect(block).toContain('дедуплікації')
    expect(block).toContain('GA4_MEASUREMENT_ID')
  })
})
