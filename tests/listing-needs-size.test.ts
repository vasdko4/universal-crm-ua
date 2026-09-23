import { describe, it, expect } from 'vitest'
import { listingNeedsSizeChoice, toListingCard, type ShopProduct } from '@/lib/shop/queries'

function product(overrides: Partial<ShopProduct> = {}): ShopProduct {
  return {
    id: 1,
    name: 'Ролики',
    slug: 'rolyky',
    description: 'long',
    price: 1375,
    oldPrice: null,
    currency: 'UAH',
    quantity: 4,
    inStock: true,
    stockStatus: null,
    image: '/a.jpg',
    images: ['/a.jpg', '/b.jpg'],
    sizes: ['34-37'],
    options: [],
    variants: [],
    variantsEnabled: false,
    isPopular: false,
    sku: null,
    barcode: null,
    weight: null,
    metaTitle: null,
    metaDescription: 'meta',
    purchasedCount: 0,
    availabilityMode: 'default',
    isComingSoon: false,
    isPreorder: false,
    ...overrides,
  }
}

describe('listingNeedsSizeChoice', () => {
  it('is false for an adjustable range stored only as a characteristic', () => {
    expect(listingNeedsSizeChoice(product({ sizes: ['34-37'] }))).toBe(false)
  })

  it('is false when variants are on but there is only one value', () => {
    expect(
      listingNeedsSizeChoice(
        product({
          variantsEnabled: true,
          options: [{ name: 'Розмір', type: 'text', values: ['34-37'] }],
          variants: [{ id: 1, sku: null, price: 1375, oldPrice: null, quantity: 1, inStock: true, image: null, options: { Розмір: '34-37' } }],
        }),
      ),
    ).toBe(false)
  })

  it('is true when several variants exist', () => {
    const variant = (id: number, size: string) => ({
      id,
      sku: null,
      price: 1000,
      oldPrice: null,
      quantity: 1,
      inStock: true,
      image: null,
      options: { Розмір: size },
    })
    expect(
      listingNeedsSizeChoice(
        product({
          variantsEnabled: true,
          options: [{ name: 'Розмір', type: 'text', values: ['38', '40', '42'] }],
          variants: [variant(1, '38'), variant(2, '40'), variant(3, '42')],
        }),
      ),
    ).toBe(true)
  })
})

describe('toListingCard', () => {
  it('keeps the size-choice flag after stripping options and variants', () => {
    const card = toListingCard(
      product({
        variantsEnabled: true,
        options: [{ name: 'Розмір', type: 'text', values: ['38', '40'] }],
        variants: [
          { id: 1, sku: null, price: 1000, oldPrice: null, quantity: 1, inStock: true, image: null, options: { Розмір: '38' } },
          { id: 2, sku: null, price: 1000, oldPrice: null, quantity: 1, inStock: true, image: null, options: { Розмір: '40' } },
        ],
      }),
    )
    expect(card.options).toEqual([])
    expect(card.variants).toEqual([])
    expect(card.needsSizeChoice).toBe(true)
  })

  it('does not flag a single-range product after the strip', () => {
    const card = toListingCard(product({ sizes: ['34-37'] }))
    expect(card.needsSizeChoice).toBe(false)
  })
})
