import { describe, it, expect } from 'vitest'
import {
  canWrite,
  hasPermission,
  permissionForPath,
  readPermission,
  writePermission,
} from '@/lib/permissions'

describe('hasPermission', () => {
  it('grants everything with wildcard', () => {
    expect(hasPermission(['*'], 'orders')).toBe(true)
    expect(hasPermission(['*'], 'settings')).toBe(true)
  })

  it('checks specific keys', () => {
    expect(hasPermission(['orders', 'products'], 'orders')).toBe(true)
    expect(hasPermission(['orders'], 'settings')).toBe(false)
  })

  it('treats :read and :write as enough to open the section', () => {
    expect(hasPermission(['orders:write'], 'orders')).toBe(true)
    expect(hasPermission(['orders:read'], 'orders')).toBe(true)
  })

  it('denies for empty or missing lists', () => {
    expect(hasPermission([], 'orders')).toBe(false)
    expect(hasPermission(undefined, 'orders')).toBe(false)
    expect(hasPermission(null, 'orders')).toBe(false)
  })
})

describe('canWrite', () => {
  it('allows wildcard and explicit write keys', () => {
    expect(canWrite(['*'], 'orders')).toBe(true)
    expect(canWrite(['orders:write'], 'orders')).toBe(true)
    expect(writePermission('orders')).toBe('orders:write')
    expect(readPermission('orders')).toBe('orders:read')
  })

  it('keeps legacy bare keys as full access', () => {
    expect(canWrite(['orders'], 'orders')).toBe(true)
  })

  it('treats :read as read-only', () => {
    expect(hasPermission(['orders:read'], 'orders')).toBe(true)
    expect(canWrite(['orders:read'], 'orders')).toBe(false)
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
