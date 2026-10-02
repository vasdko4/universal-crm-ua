import { describe, it, expect } from 'vitest'
import { storefrontAuthShortcut } from '@/lib/shop/auth-shortcuts'

describe('storefrontAuthShortcut', () => {
  it('sends short login/register URLs to the account pages', () => {
    expect(storefrontAuthShortcut('/login')).toBe('/account/login')
    expect(storefrontAuthShortcut('/register')).toBe('/account/register')
    expect(storefrontAuthShortcut('/signup')).toBe('/account/register')
  })

  it('does not steal the admin sign-in page', () => {
    expect(storefrontAuthShortcut('/sign-in')).toBeNull()
    expect(storefrontAuthShortcut('/admin')).toBeNull()
  })

  it('sends the legacy wishlist URL to the account favorites page', () => {
    expect(storefrontAuthShortcut('/account/wishlist')).toBe('/account/favorites')
  })

  it('leaves the real account favorites page alone', () => {
    expect(storefrontAuthShortcut('/account/favorites')).toBeNull()
  })

  it('leaves the real profile page alone', () => {
    expect(storefrontAuthShortcut('/account/profile')).toBeNull()
  })
})
