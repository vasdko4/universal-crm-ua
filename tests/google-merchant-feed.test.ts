import { describe, it, expect } from 'vitest'
import {
  normalizeGtin,
  formatShippingPrice,
  formatShippingWeightKg,
  priceTag,
  expandFeedOffers,
  buildItemXml,
  variantColorSize,
  htmlToPlainText,
  type FeedProduct,
  type MerchantFeedSettings,
} from '@/lib/shop/google-merchant-feed'

function product(over: Partial<FeedProduct> = {}): FeedProduct {
  const base: FeedProduct = {
    id: 12,
    name: 'iPhone 15',
    slug: 'iphone-15',
    description: '<p>Флагман</p>',
    price: 39999,
    oldPrice: 42999,
    currency: 'UAH',
    inStock: true,
    image: '/img/iphone.jpg',
    images: ['/img/iphone.jpg', '/img/back.jpg'],
    sku: 'IP15',
    barcode: '5901234123457',
    weight: 0.35,
    feedTitle: null,
    variantsEnabled: false,
    variants: [],
    isPreorder: false,
    brand: 'Apple',
  }
  return { ...base, ...over }
}

const merchant: MerchantFeedSettings = {
  googleProductCategory: 'Electronics > Communications > Telephony > Mobile Phones',
  shippingPrice: '80',
  shippingCountry: 'ua',
}

describe('Merchant identifiers', () => {
  it('accepts EAN-13 / UPC / GTIN-14 and strips punctuation', () => {
    expect(normalizeGtin('5901234123457')).toBe('5901234123457')
    expect(normalizeGtin('012345678905')).toBe('012345678905')
    expect(normalizeGtin('5901-2341-23457')).toBe('5901234123457')
    expect(normalizeGtin('123')).toBeNull()
    expect(normalizeGtin('')).toBeNull()
  })
})

describe('Merchant money / weight', () => {
  it('formats price as 80.00 UAH', () => {
    expect(priceTag(80, 'uah')).toBe('80.00 UAH')
  })

  it('normalizes admin shipping input', () => {
    expect(formatShippingPrice('80')).toBe('80.00 UAH')
    expect(formatShippingPrice('60 UAH')).toBe('60.00 UAH')
    expect(formatShippingPrice('70,5 грн')).toBe('70.50 UAH')
    expect(formatShippingPrice('безкоштовно')).toBeNull()
    expect(formatShippingPrice('')).toBeNull()
  })

  it('formats weight in kg', () => {
    expect(formatShippingWeightKg(0.35)).toBe('0.350 kg')
    expect(formatShippingWeightKg(0)).toBeNull()
  })
})

describe('variant expansion', () => {
  it('maps color/size option names in uk/ru/en', () => {
    expect(variantColorSize({ Колір: 'Чорний', Розмір: 'M' })).toEqual({
      color: 'Чорний',
      size: 'M',
    })
  })

  it('emits one offer per in-stock variant with item_group_id', () => {
    const offers = expandFeedOffers(
      product({
        variantsEnabled: true,
        variants: [
          {
            id: 1,
            options: { Колір: 'Чорний' },
            sku: 'IP15-BLK',
            price: 39999,
            oldPrice: null,
            quantity: 2,
            inStock: true,
            image: '/img/black.jpg',
          },
          {
            id: 2,
            options: { Колір: 'Синій' },
            sku: 'IP15-BLU',
            price: 40999,
            oldPrice: null,
            quantity: 0,
            inStock: false,
            image: null,
          },
        ],
      }),
    )
    expect(offers).toHaveLength(1)
    expect(offers[0]).toMatchObject({
      id: '12-1',
      itemGroupId: '12',
      sku: 'IP15-BLK',
      color: 'Чорний',
    })
  })

  it('never inherits the parent oldPrice for variants (no fake sale_price)', () => {
    const offers = expandFeedOffers(
      product({
        price: 39999,
        oldPrice: 42999, // the parent product is on sale
        variantsEnabled: true,
        variants: [
          {
            id: 1,
            options: { Колір: 'Чорний' },
            sku: 'IP15-BLK',
            price: 39999,
            oldPrice: null, // this variant was never on sale
            quantity: 2,
            inStock: true,
            image: '/img/black.jpg',
          },
          {
            id: 2,
            options: { Колір: 'Білий' },
            sku: 'IP15-WHT',
            price: 37999,
            oldPrice: 41999, // this variant has its own sale
            quantity: 2,
            inStock: true,
            image: null,
          },
        ],
      }),
    )
    expect(offers).toHaveLength(2)
    expect(offers[0].oldPrice).toBeNull()
    expect(offers[1].oldPrice).toBe(41999)
    const xmlNoSale = buildItemXml(offers[0], 'https://magazine.store', 'uk', merchant)
    expect(xmlNoSale).toContain('<g:price>39999.00 UAH</g:price>')
    expect(xmlNoSale).not.toContain('<g:sale_price>')
    const xmlSale = buildItemXml(offers[1], 'https://magazine.store', 'uk', merchant)
    expect(xmlSale).toContain('<g:price>41999.00 UAH</g:price>')
    expect(xmlSale).toContain('<g:sale_price>37999.00 UAH</g:sale_price>')
  })
})

describe('item XML', () => {
  it('includes gtin, formatted shipping, weight, and never identifier_exists=no when gtin is set', () => {
    const [offer] = expandFeedOffers(product())
    const xml = buildItemXml(offer, 'https://magazine.store', 'uk', merchant)
    expect(xml).toContain('<g:gtin>5901234123457</g:gtin>')
    expect(xml).toContain('<g:brand>Apple</g:brand>')
    // The internal SKU is not a manufacturer part number and must never
    // be emitted as g:mpn.
    expect(xml).not.toContain('<g:mpn>')
    expect(xml).not.toContain('identifier_exists')
    expect(xml).toContain('<g:price>42999.00 UAH</g:price>')
    expect(xml).toContain('<g:sale_price>39999.00 UAH</g:sale_price>')
    expect(xml).toContain('<g:price>80.00 UAH</g:price>')
    expect(xml).toContain('<g:country>UA</g:country>')
    expect(xml).toContain('<g:shipping_weight>0.350 kg</g:shipping_weight>')
    expect(xml).toContain('https://magazine.store/product/iphone-15')
    expect(xml).toContain('https://magazine.store/img/iphone.jpg')
    expect(xml).not.toContain('<p>')
  })

  it('proxies Prom.ua photos through /api/media', () => {
    const [offer] = expandFeedOffers(
      product({
        image: 'https://images.prom.ua/1_w700_h500_x.jpg',
        images: ['https://images.prom.ua/1_w700_h500_x.jpg'],
      }),
    )
    const xml = buildItemXml(offer, 'https://magazine.store', 'uk', merchant)
    expect(xml).toContain('/api/media?src=')
    expect(xml).not.toContain('>https://images.prom.ua/')
  })

  it('sets identifier_exists=no when there is no gtin and no brand+sku', () => {
    const [offer] = expandFeedOffers(product({ brand: null, sku: null, barcode: null, oldPrice: null }))
    const xml = buildItemXml(offer, 'https://magazine.store', 'uk', {
      googleProductCategory: '',
      shippingPrice: '',
      shippingCountry: 'UA',
    })
    expect(xml).toContain('<g:identifier_exists>no</g:identifier_exists>')
    expect(xml).not.toContain('<g:gtin>')
    expect(xml).not.toContain('<g:shipping>')
  })
})

describe('htmlToPlainText', () => {
  it('strips tags and does not resurrect encoded markup', () => {
    expect(htmlToPlainText('<p>Флагман</p>')).toBe('Флагман')
    expect(htmlToPlainText('Hi <script>alert(1)</script> there')).toBe('Hi there')
    expect(htmlToPlainText('<p>A & B</p>')).toBe('A & B')
    expect(htmlToPlainText('<img src=x onerror=alert(1)>')).not.toContain('<')
    expect(htmlToPlainText('<p>ok</p>')).not.toContain('<')
  })
})

describe('feed hygiene', () => {
  it('expandFeedOffers skips products with a blank name (broken Prom.ua import rows)', () => {
    expect(expandFeedOffers(product({ name: '' }))).toEqual([])
    expect(expandFeedOffers(product({ name: '   ' }))).toEqual([])
    expect(expandFeedOffers(product({ name: 'iPhone 15' }))).toHaveLength(1)
  })

  it('prefers the short feed title over the full product name', () => {
    const [offer] = expandFeedOffers(
      product({
        name: 'Мережевий зарядний пристрій з кабелем ACEFAST A118 PD30W mini GaN USB-C fast charger set (P16) Black',
        feedTitle: 'Мережевий зарядний пристрій з кабелем ACEFAST A118 PD30W mini GaN',
      }),
    )
    expect(offer.name).toBe('Мережевий зарядний пристрій з кабелем ACEFAST A118 PD30W mini GaN')
  })

  it('falls back to the product name when the feed title is empty', () => {
    const [offer] = expandFeedOffers(product({ feedTitle: null }))
    expect(offer.name).toBe('iPhone 15')
    const [blank] = expandFeedOffers(product({ feedTitle: '   ' }))
    expect(blank.name).toBe('iPhone 15')
  })

  it('appends variant options to the feed title, not the full name', () => {
    const [offer] = expandFeedOffers(
      product({
        name: 'Футболка чоловіча бавовняна з довгим рукавом і принтом на грудях',
        feedTitle: 'Футболка чоловіча бавовняна з принтом',
        variantsEnabled: true,
        variants: [
          {
            id: 1,
            options: { Розмір: 'XL' },
            sku: null,
            price: 1000,
            oldPrice: null,
            quantity: 2,
            inStock: true,
            image: null,
          },
        ],
      }),
    )
    expect(offer.name).toBe('Футболка чоловіча бавовняна з принтом — XL')
  })

  it('buildItemXml never emits an item without title, price, or id', () => {
    const [offer] = expandFeedOffers(product())
    const good = buildItemXml(offer, 'https://magazine.store', 'uk', merchant)
    expect(good).toContain('<title>iPhone 15</title>')
    expect(buildItemXml({ ...offer, name: '' }, 'https://magazine.store', 'uk', merchant)).toBe('')
    expect(buildItemXml({ ...offer, name: '  ' }, 'https://magazine.store', 'uk', merchant)).toBe('')
    expect(buildItemXml({ ...offer, price: 0 }, 'https://magazine.store', 'uk', merchant)).toBe('')
    expect(buildItemXml({ ...offer, price: -5 }, 'https://magazine.store', 'uk', merchant)).toBe('')
  })
})
