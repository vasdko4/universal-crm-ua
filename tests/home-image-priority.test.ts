import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(import.meta.dirname, '..')
const source = (file: string) => readFileSync(resolve(root, file), 'utf8')

describe('homepage image loading budget', () => {
  it('does not mark the below-the-fold infinite grid as high priority', () => {
    const home = source('app/(shop)/page.tsx')
    expect(home).toMatch(/<InfiniteProducts[\s\S]*priorityInitialImages=\{false\}/)
  })

  it('keeps catalogue pages able to prioritize their first visible row', () => {
    const grid = source('components/shop/infinite-products.tsx')
    expect(grid).toContain('priorityInitialImages = true')
    expect(grid).toContain('priority={priorityInitialImages && i < 2}')
  })
})
