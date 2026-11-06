import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createLocalStorageStore } from '../lib/admin/local-storage-store'

type FakeWindow = {
  localStorage: {
    getItem: (key: string) => string | null
    setItem: (key: string, value: string) => void
  }
  addEventListener: (type: string, fn: (e: { key: string | null }) => void) => void
  removeEventListener: (type: string, fn: (e: { key: string | null }) => void) => void
  dispatch: (type: string, event: { key: string | null }) => void
}

function makeWindow(throwOnSet = false): FakeWindow {
  const data = new Map<string, string>()
  const listeners = new Map<string, Set<(e: { key: string | null }) => void>>()
  return {
    localStorage: {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => {
        if (throwOnSet) throw new Error('quota')
        data.set(key, value)
      },
    },
    addEventListener: (type, fn) => {
      if (!listeners.has(type)) listeners.set(type, new Set())
      listeners.get(type)!.add(fn)
    },
    removeEventListener: (type, fn) => {
      listeners.get(type)?.delete(fn)
    },
    dispatch: (type, event) => {
      listeners.get(type)?.forEach((fn) => fn(event))
    },
  }
}

function makeStore(win: FakeWindow) {
  ;(globalThis as unknown as { window: unknown }).window = win
  return createLocalStorageStore<string[]>({
    key: 'test:cols',
    parse: (raw) => (raw ? (JSON.parse(raw) as string[]) : ['a', 'b']),
    serialize: (value) => JSON.stringify(value),
    fallback: ['a', 'b'],
  })
}

describe('createLocalStorageStore', () => {
  let win: FakeWindow

  beforeEach(() => {
    win = makeWindow()
  })

  it('returns the fallback when storage is empty', () => {
    expect(makeStore(win).getSnapshot()).toEqual(['a', 'b'])
  })

  it('returns the same reference while the stored raw string is unchanged', () => {
    const store = makeStore(win)
    expect(store.getSnapshot()).toBe(store.getSnapshot())
    win.localStorage.setItem('test:cols', JSON.stringify(['a']))
    const first = store.getSnapshot()
    expect(store.getSnapshot()).toBe(first)
    expect(first).toEqual(['a'])
  })

  it('persists via set and notifies subscribers', () => {
    const store = makeStore(win)
    const listener = vi.fn()
    const unsubscribe = store.subscribe(listener)
    store.set(['b'])
    expect(win.localStorage.getItem('test:cols')).toBe(JSON.stringify(['b']))
    expect(store.getSnapshot()).toEqual(['b'])
    expect(listener).toHaveBeenCalledTimes(1)
    unsubscribe()
    store.set(['a'])
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('notifies subscribers on a storage event for its key only', () => {
    const store = makeStore(win)
    const listener = vi.fn()
    store.subscribe(listener)
    win.dispatch('storage', { key: 'other:key' })
    expect(listener).not.toHaveBeenCalled()
    win.dispatch('storage', { key: 'test:cols' })
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('falls back on invalid JSON', () => {
    win.localStorage.setItem('test:cols', 'not-json{')
    expect(makeStore(win).getSnapshot()).toEqual(['a', 'b'])
  })

  it('keeps the session-only value when the write fails', () => {
    const failing = makeWindow(true)
    const store = makeStore(failing)
    store.set(['b'])
    expect(store.getSnapshot()).toEqual(['b'])
  })
})
