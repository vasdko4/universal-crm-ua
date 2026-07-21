import { describe, it, expect } from 'vitest'
import { hasPermission, permissionForPath } from '@/lib/permissions'

describe('hasPermission', () => {
  it('grants everything with wildcard', () => {
    expect(hasPermission(['*'], 'orders')).toBe(true)
    expect(hasPermission(['*'], 'settings')).toBe(true)
  })

  it('checks specific keys', () => {
    expect(hasPermission(['orders', 'products'], 'orders')).toBe(true)
    expect(hasPermission(['orders'], 'settings')).toBe(false)
  })

  it('denies for empty or missing lists', () => {
    expect(hasPermission([], 'orders')).toBe(false)
    expect(hasPermission(undefined, 'orders')).toBe(false)
    expect(hasPermission(null, 'orders')).toBe(false)
  })
})

describe('permissionForPath', () => {
  it('maps the dashboard exactly', () => {
    expect(permissionForPath('/admin')).toBe('dashboard')
  })

  it('maps nested admin routes', () => {
    expect(permissionForPath('/admin/orders')).toBe('orders')
    expect(permissionForPath('/admin/orders/12')).toBe('orders')
    expect(permissionForPath('/admin/settings')).toBe('settings')
  })

  it('returns null for non-admin routes', () => {
    expect(permissionForPath('/catalog')).toBeNull()
  })
})
