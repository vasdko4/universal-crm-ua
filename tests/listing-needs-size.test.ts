import { describe, it, expect } from 'vitest'

/** Mirrors ProductCard: "Обрати розмір" only when there is a real choice. */
function listingNeedsSize(product: {
  variantsEnabled: boolean
  options: { values: string[] }[]
  variants: unknown[]
}): boolean {
  return (
    product.variantsEnabled &&
    product.options.some((o) => o.values.length > 1) &&
    product.variants.length > 1
  )
}

describe('listing choose-size button', () => {
  it('buys immediately when the only "size" is one adjustable range', () => {
    expect(
      listingNeedsSize({
        variantsEnabled: false,
        options: [],
        variants: [],
      }),
    ).toBe(false)
  })

  it('buys immediately when variants are on but there is only one value', () => {
    expect(
      listingNeedsSize({
        variantsEnabled: true,
        options: [{ values: ['34-37'] }],
        variants: [{ id: 1 }],
      }),
    ).toBe(false)
  })

  it('asks to choose a size when several variants exist', () => {
    expect(
      listingNeedsSize({
        variantsEnabled: true,
        options: [{ values: ['38', '40', '42'] }],
        variants: [{ id: 1 }, { id: 2 }, { id: 3 }],
      }),
    ).toBe(true)
  })
})
