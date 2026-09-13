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

  it('collapses missing account subpages onto live routes', () => {
    expect(storefrontAuthShortcut('/account/profile')).toBe('/account')
    expect(storefrontAuthShortcut('/account/favorites')).toBe('/favorites')
    expect(storefrontAuthShortcut('/account/wishlist')).toBe('/favorites')
  })
})
