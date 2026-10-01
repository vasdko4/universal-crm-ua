import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/db', () => ({ pool: { query: vi.fn() } }))
vi.mock('@/lib/store-settings', () => ({
  getStoreSettingsInternal: vi.fn(),
}))

import { buildAdminOrderHtml } from '@/lib/notifications'

const order = {
  id: 42,
  orderNumber: 'A-1001',
  customerName: 'Іван <b>Петренко</b>',
  customerPhone: '+380 99 123 45 67',
  customerEmail: 'ivan@example.com',
  deliveryMethod: 'nova_poshta',
  deliveryCity: 'Київ',
  deliveryBranch: 'Відділення 5',
  deliveryAddress: null,
  paymentMethod: 'cod',
  paymentStatus: 'pending',
  itemsTotal: '1000',
  total: '1060',
  currency: 'UAH',
  status: 'new',
  note: null,
} as never

const items = [
  {
    id: 1,
    productId: 7,
    name: 'Кросівки <script>',
    variantLabel: '43',
    sku: 'SN-1',
    image: '/uploads/sn.jpg',
    price: '1000',
    quantity: 1,
    total: '1000',
  },
] as never

describe('buildAdminOrderHtml', () => {
  it('renders a rich admin alert with escaped customer data', () => {
    const html = buildAdminOrderHtml(order, items, 'https://shop.test', { 7: 'krosivky' })
    expect(html).toContain('Новый заказ №A-1001')
    expect(html).toContain('Іван &lt;b&gt;Петренко&lt;/b&gt;')
    expect(html).not.toContain('<b>Петренко</b>')
    expect(html).toContain('Кросівки &lt;script&gt;')
    expect(html).not.toContain('Кросівки <script>')
    expect(html).toContain('https://shop.test/product/krosivky')
    expect(html).toContain('https://shop.test/admin/orders/42')
    expect(html).toContain('1 060 ₴')
    expect(html).toContain('⏳ Не оплачен')
    // hidden preheader for the inbox preview
    expect(html).toContain('display:none')
    expect(html).toContain('A-1001')
  })

  it('omits optional rows when data is missing', () => {
    const minimal = buildAdminOrderHtml(
      { ...order, customerEmail: null, deliveryMethod: null, deliveryCity: null, deliveryBranch: null, note: null } as never,
      [],
      '',
    )
    expect(minimal).not.toContain('mailto:')
    expect(minimal).not.toContain('Доставка')
    expect(minimal).toContain('Новый заказ №A-1001')
  })
})
