import { test, expect } from '@playwright/test'

const LIVE = process.env.LIVE_SHOP_URL || process.env.PLAYWRIGHT_BASE_URL || ''

test.skip(!LIVE, 'LIVE_SHOP_URL / PLAYWRIGHT_BASE_URL is not set')

test.use({ baseURL: LIVE || undefined })

test('live shop engine: cart must not 500', async ({ request, page }) => {
  const health = await request.get('/api/health')
  expect(health.ok(), await health.text()).toBeTruthy()

  const cart = await request.get('/cart')
  expect(cart.status(), await cart.text()).toBe(200)

  const home = await page.goto('/')
  expect(home?.ok()).toBeTruthy()
  await expect(page.locator('header').first()).toBeVisible()

  const cartPage = await page.goto('/cart')
  expect(cartPage?.ok()).toBeTruthy()
  await expect(page.locator('html#__next_error__')).toHaveCount(0)
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/кошик|корзин/i)
})

test('live shop engine: security headers and no Sentry', async ({ request }) => {
  const res = await request.get('/')
  expect(res.ok()).toBeTruthy()
  const csp = res.headers()['content-security-policy'] || ''
  expect(csp).toMatch(/nonce-/)
  expect(csp).not.toMatch(/unsafe-eval/)
  expect(res.headers()['x-frame-options']?.toLowerCase()).toBe('deny')
  expect(csp).toMatch(/frame-ancestors 'none'/)
  const html = await res.text()
  expect(html.toLowerCase()).not.toMatch(/browser\.sentry|ingest\.sentry|cdn\.sentry/)
})
