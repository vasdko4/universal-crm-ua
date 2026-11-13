import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock data must be hoisted: vi.mock factories run before the module body,
// so plain top-level consts would hit the TDZ.
const { LIST_PRODUCT, DETAIL } = vi.hoisted(() => ({
  LIST_PRODUCT: {
    id: 1,
    slug: 'cable-x',
    name: 'Cable X',
    price: 150,
    oldPrice: 199,
    currency: 'UAH',
    image: '/img/cable.jpg',
    images: ['/img/cable.jpg'],
    inStock: true,
    isPreorder: false,
  },
  DETAIL: {
    product: {
      id: 1,
      slug: 'cable-x',
      name: 'Cable X',
      description: '<p>Fast <b>charging</b> cable.</p>',
      price: 150,
      oldPrice: 199,
      currency: 'UAH',
      sku: 'CX-01',
      barcode: '4820000000014',
      image: '/img/cable.jpg',
      images: ['/img/cable.jpg', '/img/cable-2.jpg'],
      inStock: true,
      isPreorder: false,
    },
    characteristics: [
      { name: 'Бренд', value: 'ACEFAST' },
      { name: 'Довжина', value: '1.2 м' },
    ],
    categories: [{ id: 7, slug: 'cables', name: 'Кабелі' }],
  },
}))

vi.mock('@/lib/api/rate-limit', () => ({
  clientIp: vi.fn(() => '1.2.3.4'),
  isRateLimited: vi.fn(async () => false),
}))
vi.mock('@/lib/shop/queries', () => ({
  getCatalogProducts: vi.fn(async (params: Record<string, unknown>) => ({
    items: [LIST_PRODUCT],
    total: 1,
    page: (params?.page as number) ?? 1,
    perPage: (params?.perPage as number) ?? 20,
  })),
  getCategoryBySlugOrId: vi.fn(async (param: string) =>
    param === 'cables' || param === '7' ? { id: 7, slug: 'cables', name: 'Кабелі' } : null,
  ),
  getProductBySlug: vi.fn(async (slug: string) => (slug === 'cable-x' ? DETAIL : null)),
  getShopCategories: vi.fn(async () => [
    { id: 7, slug: 'cables', name: 'Кабелі' },
    { id: 9, slug: 'chargers', name: 'Зарядки' },
  ]),
}))
vi.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) =>
      Response.json(body as Record<string, unknown>, init),
  },
}))

import { GET as listProducts } from '@/app/api/v1/products/route'
import { GET as getProduct } from '@/app/api/v1/products/[slug]/route'
import { GET as listCategories } from '@/app/api/v1/categories/route'
import { isRateLimited } from '@/lib/api/rate-limit'
import {
  getCatalogProducts,
  getCategoryBySlugOrId,
  getProductBySlug,
  getShopCategories,
} from '@/lib/shop/queries'

const mockedIsRateLimited = vi.mocked(isRateLimited)
const mockedCatalog = vi.mocked(getCatalogProducts)
const mockedCategoryLookup = vi.mocked(getCategoryBySlugOrId)
const mockedProductBySlug = vi.mocked(getProductBySlug)
const mockedCategories = vi.mocked(getShopCategories)

function get(url: string) {
  return new Request(`http://localhost${url}`)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/v1/products', () => {
  it('returns mapped items with pagination defaults', async () => {
    const res = await listProducts(get('/api/v1/products'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({
      success: true,
      data: {
        items: [
          {
            id: 1,
            slug: 'cable-x',
            name: 'Cable X',
            price: 150,
            oldPrice: 199,
            currency: 'UAH',
            image: '/img/cable.jpg',
            inStock: true,
            isPreorder: false,
          },
        ],
        total: 1,
        page: 1,
        perPage: 20,
      },
    })
    expect(mockedCatalog).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, perPage: 20, locale: 'uk' }),
    )
    // No category filter -> no category key on list items.
    expect(body.data.items[0]).not.toHaveProperty('category')
  })

  it('passes page/perPage through', async () => {
    await listProducts(get('/api/v1/products?page=2&perPage=50'))
    expect(mockedCatalog).toHaveBeenCalledWith(
      expect.objectContaining({ page: 2, perPage: 50 }),
    )
  })

  it('rejects bad pagination with 400 and does not query', async () => {
    for (const url of [
      '/api/v1/products?page=0',
      '/api/v1/products?page=abc',
      '/api/v1/products?perPage=0',
      '/api/v1/products?perPage=101',
      '/api/v1/products?perPage=abc',
    ]) {
      const res = await listProducts(get(url))
      expect(res.status).toBe(400)
      expect(await res.json()).toMatchObject({ success: false })
    }
    expect(mockedCatalog).not.toHaveBeenCalled()
  })

  it('rejects an unknown sort with 400 and does not query', async () => {
    const res = await listProducts(get('/api/v1/products?sort=rating'))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ success: false })
    expect(mockedCatalog).not.toHaveBeenCalled()
  })

  it.each(['new', 'price_asc', 'price_desc', 'popular'])(
    'passes sort=%s through to the catalog query',
    async (sort) => {
      await listProducts(get(`/api/v1/products?sort=${sort}`))
      expect(mockedCatalog).toHaveBeenCalledWith(expect.objectContaining({ sort }))
    },
  )

  it('resolves a category slug and filters by its id', async () => {
    const res = await listProducts(get('/api/v1/products?category=cables'))
    expect(res.status).toBe(200)
    expect(mockedCategoryLookup).toHaveBeenCalledWith('cables', 'uk')
    expect(mockedCatalog).toHaveBeenCalledWith(expect.objectContaining({ categoryId: 7 }))
    const body = await res.json()
    expect(body.data.items[0].category).toEqual({ id: 7, slug: 'cables', name: 'Кабелі' })
  })

  it('resolves a numeric category id', async () => {
    await listProducts(get('/api/v1/products?category=7'))
    expect(mockedCatalog).toHaveBeenCalledWith(expect.objectContaining({ categoryId: 7 }))
  })

  it('rejects an unknown category with 400 and does not query', async () => {
    const res = await listProducts(get('/api/v1/products?category=nope'))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ success: false })
    expect(mockedCatalog).not.toHaveBeenCalled()
  })

  it('sanitizes the search term (control chars stripped, capped at 100)', async () => {
    await listProducts(get('/api/v1/products?q=a%00b'))
    expect(mockedCatalog).toHaveBeenCalledWith(expect.objectContaining({ search: 'ab' }))
    await listProducts(get(`/api/v1/products?q=${'x'.repeat(150)}`))
    const last = mockedCatalog.mock.calls.at(-1)?.[0] as { search?: string }
    expect(last.search).toHaveLength(100)
  })

  it('returns 429 with the fail envelope when rate limited', async () => {
    mockedIsRateLimited.mockResolvedValueOnce(true)
    const res = await listProducts(get('/api/v1/products'))
    expect(res.status).toBe(429)
    expect(await res.json()).toEqual({ success: false, error: 'rate_limited' })
    expect(mockedCatalog).not.toHaveBeenCalled()
  })
})

describe('GET /api/v1/products/[slug]', () => {
  function getDetail(slug: string) {
    return getProduct(get(`/api/v1/products/${slug}`), {
      params: Promise.resolve({ slug }),
    })
  }

  it('returns the full public product', async () => {
    const res = await getDetail('cable-x')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      success: true,
      data: {
        id: 1,
        slug: 'cable-x',
        name: 'Cable X',
        description: 'Fast charging cable.',
        price: 150,
        oldPrice: 199,
        currency: 'UAH',
        sku: 'CX-01',
        brand: 'ACEFAST',
        image: '/img/cable.jpg',
        images: ['/img/cable.jpg', '/img/cable-2.jpg'],
        characteristics: [
          { name: 'Бренд', value: 'ACEFAST' },
          { name: 'Довжина', value: '1.2 м' },
        ],
        category: { id: 7, slug: 'cables', name: 'Кабелі' },
        inStock: true,
        isPreorder: false,
        gtin: '4820000000014',
      },
    })
    expect(mockedProductBySlug).toHaveBeenCalledWith('cable-x', 'uk')
  })

  it('returns 404 for an unknown slug', async () => {
    const res = await getDetail('no-such-product')
    expect(res.status).toBe(404)
    expect(await res.json()).toMatchObject({ success: false })
  })

  it('omits gtin when the product has no barcode', async () => {
    mockedProductBySlug.mockResolvedValueOnce({
      ...DETAIL,
      product: { ...DETAIL.product, barcode: null },
    })
    const res = await getDetail('cable-x')
    const body = await res.json()
    expect(body.data).not.toHaveProperty('gtin')
  })

  it('omits category when the product has none and nulls an empty description', async () => {
    mockedProductBySlug.mockResolvedValueOnce({
      ...DETAIL,
      product: { ...DETAIL.product, description: null },
      categories: [],
    })
    const res = await getDetail('cable-x')
    const body = await res.json()
    expect(body.data).not.toHaveProperty('category')
    expect(body.data.description).toBeNull()
  })

  it('returns 429 with the fail envelope when rate limited', async () => {
    mockedIsRateLimited.mockResolvedValueOnce(true)
    const res = await getDetail('cable-x')
    expect(res.status).toBe(429)
    expect(await res.json()).toEqual({ success: false, error: 'rate_limited' })
    expect(mockedProductBySlug).not.toHaveBeenCalled()
  })
})

describe('GET /api/v1/categories', () => {
  it('returns the visible categories in shop order', async () => {
    const res = await listCategories(get('/api/v1/categories'))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      success: true,
      data: [
        { id: 7, slug: 'cables', name: 'Кабелі' },
        { id: 9, slug: 'chargers', name: 'Зарядки' },
      ],
    })
    expect(mockedCategories).toHaveBeenCalledWith('uk')
  })

  it('returns 429 with the fail envelope when rate limited', async () => {
    mockedIsRateLimited.mockResolvedValueOnce(true)
    const res = await listCategories(get('/api/v1/categories'))
    expect(res.status).toBe(429)
    expect(await res.json()).toEqual({ success: false, error: 'rate_limited' })
    expect(mockedCategories).not.toHaveBeenCalled()
  })
})
