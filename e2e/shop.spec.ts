import { test, expect } from '@playwright/test'

test.beforeEach(async ({ context, baseURL }) => {
  await context.addCookies([{ name: 'locale', value: 'uk', url: baseURL || 'http://127.0.0.1:3000' }])
})

test('home page renders storefront chrome', async ({ page }) => {
  const res = await page.goto('/')
  expect(res?.ok()).toBeTruthy()
  await expect(page.locator('header').first()).toBeVisible()
  await expect(page.getByRole('link', { name: /каталог/i }).first()).toBeVisible()
})

test('catalog page has a heading', async ({ page }) => {
  const res = await page.goto('/catalog')
  expect(res?.ok()).toBeTruthy()
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/каталог/i)
})

test('empty cart shows the empty state', async ({ page }) => {
  await page.goto('/cart')
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/кошик/i)
  await expect(page.getByText('Ваш кошик порожній')).toBeVisible()
  await expect(page.getByRole('link', { name: 'До каталогу' })).toBeVisible()
})

test('empty checkout sends shopper back to catalog', async ({ page }) => {
  await page.goto('/checkout')
  await expect(page.getByRole('heading', { name: 'Кошик порожній' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'До каталогу' })).toBeVisible()
})

test('catalog add-to-cart reaches a non-empty cart', async ({ page }) => {
  await page.goto('/catalog')
  const lang = page.getByRole('button', { name: 'Українська' })
  if (await lang.isVisible().catch(() => false)) await lang.click()
  const card = page.locator('article').filter({ has: page.getByRole('button', { name: 'Купити', exact: true }) }).first()
  await expect(card).toBeVisible()
  await card.getByRole('button', { name: 'Купити', exact: true }).click()
  if (page.url().includes('/product/')) {
    await page.getByRole('button', { name: /до кошика|замовити заздалегідь/i }).first().click()
  }
  await expect
    .poll(async () => {
      return page.evaluate(() => {
        try {
          const raw = localStorage.getItem('techno-cart-v1')
          const items = raw ? JSON.parse(raw) : []
          return Array.isArray(items) ? items.length : 0
        } catch {
          return 0
        }
      })
    })
    .toBeGreaterThan(0)
  await page.goto('/cart')
  await expect(page.getByText('Ваш кошик порожній')).toHaveCount(0)
  await expect(page.getByRole('link', { name: /оформити замовлення/i })).toBeVisible()
})

test('admin sign-in form is reachable', async ({ page }) => {
  const res = await page.goto('/sign-in')
  expect(res?.ok()).toBeTruthy()
  await expect(page.locator('#email')).toBeVisible()
  await expect(page.locator('#password')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Увійти' })).toBeVisible()
})
