import { test, expect } from '@playwright/test'

const E2E_ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || 'e2e-admin@gmail.com'
const E2E_ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || ''

test.beforeEach(async ({ context, baseURL }) => {
  await context.addCookies([{ name: 'locale', value: 'uk', url: baseURL || 'http://127.0.0.1:3000' }])
})

async function dismissLocaleModal(page: import('@playwright/test').Page) {
  const lang = page.getByRole('dialog').getByRole('button', { name: 'Українська' })
  if (await lang.isVisible().catch(() => false)) await lang.click()
}

async function cartItemCount(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    try {
      const raw = localStorage.getItem('techno-cart-v1')
      const items = raw ? JSON.parse(raw) : []
      return Array.isArray(items) ? items.length : 0
    } catch {
      return 0
    }
  })
}

test('home page renders storefront chrome', async ({ page }) => {
  const res = await page.goto('/')
  expect(res?.ok()).toBeTruthy()
  await expect(page.locator('header').first()).toBeVisible()
  await expect(page.getByRole('search').first()).toBeVisible()
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
  await page.goto('/catalog', { waitUntil: 'domcontentloaded' })
  await dismissLocaleModal(page)
  // Client cart writes only after hydration. Clicking the SSR button before
  // that is a no-op and leaves localStorage empty.
  await expect(page.getByTestId('cart-ready')).toHaveAttribute('data-ready', '1', { timeout: 30_000 })
  await expect(page.locator('article a[href*="/product/"]').first()).toBeVisible()

  const listingAdd = page.locator('[data-testid="add-to-cart"]:not([disabled])').first()
  if (await listingAdd.count()) {
    await listingAdd.click()
  } else {
    const chooseSize = page.getByTestId('choose-size').first()
    if (await chooseSize.count()) {
      await chooseSize.click()
    } else {
      await page.locator('article a[href*="/product/"]').first().click()
    }
    await page.waitForURL(/\/product\//)
    await expect(page.getByTestId('cart-ready')).toHaveAttribute('data-ready', '1')
    const optionButtons = page.getByTestId('product-option')
    const n = await optionButtons.count()
    for (let i = 0; i < n; i++) {
      const btn = optionButtons.nth(i)
      if (await btn.isVisible().catch(() => false)) await btn.click()
    }
    await page.getByTestId('add-to-cart').click()
  }

  await expect.poll(() => cartItemCount(page)).toBeGreaterThan(0)
  await page.goto('/cart')
  await dismissLocaleModal(page)
  await expect(page.getByTestId('cart-ready')).toHaveAttribute('data-ready', '1', { timeout: 30_000 })
  await expect.poll(() => cartItemCount(page)).toBeGreaterThan(0)
  await expect(page.getByRole('heading', { name: 'Ваш кошик порожній' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: /оформити замовлення/i })).toBeVisible()
})

test('register page is reachable', async ({ page }) => {
  const res = await page.goto('/account/register')
  expect(res?.ok()).toBeTruthy()
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page.locator('#email')).toBeVisible()
})

test('admin sign-in form is reachable', async ({ page }) => {
  const res = await page.goto('/sign-in')
  expect(res?.ok()).toBeTruthy()
  await expect(page.locator('#email')).toBeVisible()
  await expect(page.locator('#password')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Увійти' })).toBeVisible()
})

test('e2e admin can open the dashboard', async ({ page }) => {
  test.skip(!E2E_ADMIN_PASSWORD, 'E2E_ADMIN_PASSWORD is not set')
  await page.goto('/sign-in')
  await page.locator('#email').fill(E2E_ADMIN_EMAIL)
  await page.locator('#password').fill(E2E_ADMIN_PASSWORD)
  await page.getByRole('button', { name: 'Увійти' }).click()
  await page.waitForURL(/\/admin/, { timeout: 30_000 })
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/Ласкаво просимо|Admin/i)
  await page.locator('aside').getByRole('link', { name: 'Замовлення' }).click()
  await page.waitForURL(/\/admin\/orders/, { timeout: 15_000 })
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await page.locator('aside').getByRole('link', { name: 'Клієнти' }).click()
  await page.waitForURL(/\/admin\/customers/, { timeout: 15_000 })
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await page.locator('aside').getByRole('link', { name: 'Акції' }).click()
  await page.waitForURL(/\/admin\/promotions/, { timeout: 15_000 })
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await page.locator('aside').getByRole('link', { name: 'Платежі' }).click()
  await page.waitForURL(/\/admin\/payments/, { timeout: 15_000 })
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await page.locator('aside').getByRole('link', { name: 'Модальна реклама' }).click()
  await page.waitForURL(/\/admin\/modal-ads/, { timeout: 15_000 })
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
})

test('e2e admin can open the storefront cabinet', async ({ page }) => {
  test.skip(!E2E_ADMIN_PASSWORD, 'E2E_ADMIN_PASSWORD is not set')
  await page.goto('/account/login')
  await dismissLocaleModal(page)
  await page.locator('#email').fill(E2E_ADMIN_EMAIL)
  await page.locator('#password').fill(E2E_ADMIN_PASSWORD)
  await page.getByRole('button', { name: 'Увійти' }).click()
  await page.waitForURL(/\/account(?:$|\?)/, { timeout: 30_000 })
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/Вітаємо/i)
  await expect(page.getByRole('heading', { level: 2 })).toContainText(/дані/i)
  await expect(page.getByRole('button', { name: 'Змінити пошту' })).toBeVisible()
  await expect(page.getByRole('button', { name: /парол/i })).toBeVisible()
  const ordersNav = page.locator('nav').getByRole('link', { name: 'Мої замовлення' })
  await expect(ordersNav).toBeVisible()
  await ordersNav.click()
  await expect(page.getByRole('heading', { level: 2 })).toContainText(/замовлен/i)
  await page.locator('nav').getByRole('link', { name: 'Мої адреси' }).click()
  await expect(page.getByRole('heading', { level: 2 })).toContainText(/адрес/i)
  await page.locator('nav').getByRole('link', { name: 'Промокоди' }).click()
  await expect(page.getByRole('heading', { level: 2 })).toContainText(/промокод/i)
})
