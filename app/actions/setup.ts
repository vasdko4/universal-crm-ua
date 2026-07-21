'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { getAuth } from '@/lib/auth'
import { pool } from '@/lib/db'
import { revalidateTag } from 'next/cache'
import { normalizeOrigin } from '@/lib/seo'

// Essential operational data every fresh install needs to function: admin/staff
// roles (permissions live here), plus the default delivery and payment methods.
// All inserts are idempotent so re-running is safe.
const SYSTEM_SQL = `
INSERT INTO "roles" ("code","name","description","permissions","is_system") VALUES
  ('admin','Администратор','Полный доступ ко всем модулям','["*"]'::jsonb,true),
  ('manager','Менеджер','Управление заказами, товарами, клиентами','["dashboard","orders","products","customers","reviews"]'::jsonb,true),
  ('content','Контент-менеджер','Управление контентом и маркетингом','["dashboard","pages","articles","promotions","reviews"]'::jsonb,false),
  ('customer','Покупатель','Клиент магазина (без доступа в админку)','[]'::jsonb,true)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "delivery_methods" ("code","name","is_active","is_removable","config","sort_order") VALUES
  ('nova_poshta','Нова Пошта',true,false,'{"apiKey":""}'::jsonb,1),
  ('ukrposhta','Укрпошта',false,true,'{}'::jsonb,2)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "payment_methods" ("code","name","is_active","config","sort_order") VALUES
  ('cod','Наложенный платёж',true,'{}'::jsonb,1),
  ('online','Онлайн оплата (платёжные шлюзы)',true,'{}'::jsonb,2),
  ('requisites','Оплата по реквизитам',true,'{}'::jsonb,3)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "payment_gateways" ("code","name","is_active","is_test_mode","config","sort_order") VALUES
  ('wayforpay','WayForPay',false,true,'{"merchantAccount":"","merchantSecretKey":"","merchantDomainName":""}'::jsonb,1),
  ('monobank','Monobank Acquiring',false,true,'{"token":""}'::jsonb,2)
ON CONFLICT ("code") DO NOTHING;

-- Bilingual legal pages (Укр/Ру). Linked in the storefront footer via /p/<slug>.
INSERT INTO "pages" ("title","title_ru","slug","content","content_ru","status","sort_order","published_at") VALUES
  ('Угода користувача','Пользовательское соглашение','terms',
   '<p>Ця Угода користувача регулює використання інтернет-магазину. Користуючись сайтом, ви погоджуєтесь з умовами цієї Угоди.</p><h2>1. Загальні положення</h2><p>Адміністрація сайту надає користувачу доступ до перегляду та замовлення товарів.</p><h2>2. Замовлення</h2><p>Оформлюючи замовлення, користувач підтверджує достовірність наданих даних.</p><h2>3. Відповідальність</h2><p>Сторони несуть відповідальність згідно з чинним законодавством України.</p>',
   '<p>Настоящее Пользовательское соглашение регулирует использование интернет-магазина. Используя сайт, вы соглашаетесь с условиями данного Соглашения.</p><h2>1. Общие положения</h2><p>Администрация сайта предоставляет пользователю доступ к просмотру и заказу товаров.</p><h2>2. Заказы</h2><p>Оформляя заказ, пользователь подтверждает достоверность предоставленных данных.</p><h2>3. Ответственность</h2><p>Стороны несут ответственность в соответствии с действующим законодательством Украины.</p>',
   'published',1,now()),
  ('Політика конфіденційності','Политика конфиденциальности','privacy',
   '<p>Ми поважаємо вашу приватність та захищаємо персональні дані відповідно до законодавства України.</p><h2>1. Збір даних</h2><p>Ми збираємо лише ті дані, які необхідні для оформлення та доставки замовлення.</p><h2>2. Використання даних</h2><p>Персональні дані використовуються виключно для обробки замовлень та зв''язку з вами.</p><h2>3. Захист даних</h2><p>Ми вживаємо всіх необхідних заходів для захисту ваших персональних даних.</p>',
   '<p>Мы уважаем вашу конфиденциальность и защищаем персональные данные в соответствии с законодательством Украины.</p><h2>1. Сбор данных</h2><p>Мы собираем только те данные, которые необходимы для оформления и доставки заказа.</p><h2>2. Использование данных</h2><p>Персональные данные используются исключительно для обработки заказов и связи с вами.</p><h2>3. Защита данных</h2><p>Мы принимаем все необходимые меры для защиты ваших персональных данных.</p>',
   'published',2,now()),
  ('Політика повернення','Политика возвратов','returns',
   '<p>Ви можете повернути товар протягом 14 днів з моменту отримання згідно із Законом України «Про захист прав споживачів».</p><h2>1. Умови повернення</h2><p>Товар має бути у непошкодженому вигляді, зі збереженням товарного вигляду та упаковки.</p><h2>2. Як оформити повернення</h2><p>Зв''яжіться з нашою службою підтримки для оформлення заявки на повернення.</p><h2>3. Повернення коштів</h2><p>Кошти повертаються протягом 7 робочих днів після отримання товару.</p>',
   '<p>Вы можете вернуть товар в течение 14 дней с момента получения согласно Закону Украины «О защите прав потребителей».</p><h2>1. Условия возврата</h2><p>Товар должен быть в неповреждённом виде, с сохранением товарного вида и упаковки.</p><h2>2. Как оформить возврат</h2><p>Свяжитесь с нашей службой поддержки для оформления заявки на возврат.</p><h2>3. Возврат средств</h2><p>Средства возвращаются в течение 7 рабочих дней после получения товара.</p>',
   'published',3,now()),
  ('Доставка та оплата','Доставка и оплата','delivery',
   '<p>Ми доставляємо замовлення по всій Україні зручними для вас способами.</p><h2>1. Способи доставки</h2><ul><li>Нова Пошта — 1-3 робочі дні</li><li>Укрпошта — 3-7 робочих днів</li><li>Кур''єрська доставка по місту</li></ul><h2>2. Способи оплати</h2><ul><li>Накладений платіж при отриманні</li><li>Оплата картою онлайн</li><li>Безготівковий розрахунок</li></ul><h2>3. Вартість доставки</h2><p>Вартість доставки розраховується за тарифами перевізника.</p>',
   '<p>Мы доставляем заказы по всей Украине удобными для вас способами.</p><h2>1. Способы доставки</h2><ul><li>Нова Пошта — 1-3 рабочих дня</li><li>Укрпошта — 3-7 рабочих дней</li><li>Курьерская доставка по городу</li></ul><h2>2. Способы оплаты</h2><ul><li>Наложенный платёж при получении</li><li>Оплата картой онлайн</li><li>Безналичный расчёт</li></ul><h2>3. Стоимость доставки</h2><p>Стоимость доставки рассчитывается по тарифам перевозчика.</p>',
   'published',4,now())
ON CONFLICT ("slug") DO NOTHING;
`

export async function isSetupNeeded(): Promise<boolean> {
  try {
    const res = await pool.query('SELECT COUNT(*)::int AS c FROM "user"')
    return (res.rows[0]?.c ?? 0) === 0
  } catch {
    // If the query fails (e.g. schema missing) the app is not usable anyway;
    // treat as "needs setup" so the wizard surfaces a clear message.
    return true
  }
}

export type SetupInput = {
  admin: { name: string; email: string; password: string }
  store: { name: string; description: string; novaPoshtaApiKey: string }
  seo: {
    metaTitle: string
    metaDescription: string
    /** google-site-verification token from Search Console (optional). */
    googleVerification: string
    /** Allow Google to index the site right away. */
    indexingEnabled: boolean
  }
  installDemo: boolean
}

/**
 * Auto-detects the store's public domain from the incoming request headers.
 * Works on any hosting (Vercel, VPS behind nginx, shared hosting) because the
 * install request itself always arrives at the real domain. Local/preview
 * hosts return '' so the runtime env fallback is used instead.
 */
async function detectSiteUrl(): Promise<string> {
  try {
    const h = await headers()
    const host = h.get('x-forwarded-host')?.split(',')[0]?.trim() || h.get('host') || ''
    if (!host || /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(:\d+)?$/i.test(host)) return ''
    const proto = h.get('x-forwarded-proto')?.split(',')[0]?.trim() || 'https'
    return normalizeOrigin(`${proto}://${host}`)
  } catch {
    return ''
  }
}

export async function runSetup(input: SetupInput) {
  // Hard guard: setup can only run on a fresh install with no users.
  const needed = await isSetupNeeded()
  if (!needed) {
    return { success: false as const, error: 'Магазин уже настроен' }
  }

  const email = input.admin.email.trim().toLowerCase()
  if (!input.admin.name.trim()) return { success: false as const, error: 'Укажите имя администратора' }
  if (!email) return { success: false as const, error: 'Укажите email' }
  if (input.admin.password.length < 8)
    return { success: false as const, error: 'Пароль должен быть не короче 8 символов' }

  try {
    // 1) Seed essential system data (roles / delivery / payment).
    await pool.query(SYSTEM_SQL)

    // 2) Optionally install the full demo dataset (catalog, sample orders, etc).
    if (input.installDemo) {
      try {
        const seed = readFileSync(join(process.cwd(), 'db', 'seed.sql'), 'utf8')
        if (seed.trim()) await pool.query(seed)
      } catch {
        // Demo data is optional; ignore if the file is missing in this deploy.
      }
    }

    // 3) Create the administrator account via Better Auth, then promote it.
    const auth = await getAuth()
    await auth.api.signUpEmail({
      body: { name: input.admin.name.trim(), email, password: input.admin.password },
    })
    await pool.query(`UPDATE "user" SET role = 'admin' WHERE email = $1`, [email])

    // 4) Save store settings: name/description, auto-detected domain and SEO.
    // Written directly with SQL — runSetup is already guarded by isSetupNeeded
    // above, and the demo seed may add users which would trip other guards.
    const siteUrl = await detectSiteUrl()
    const seoJson = JSON.stringify({
      siteUrl,
      metaTitle: input.seo.metaTitle.trim(),
      metaDescription: input.seo.metaDescription.trim(),
      keywords: '',
      googleVerification: input.seo.googleVerification.trim(),
      indexingEnabled: input.seo.indexingEnabled,
    })
    await pool.query(
      `INSERT INTO "store_settings" ("id","store_name","store_description","seo","updated_at")
       VALUES (1,$1,$2,$3::jsonb,now())
       ON CONFLICT ("id") DO UPDATE SET
         "store_name" = EXCLUDED."store_name",
         "store_description" = EXCLUDED."store_description",
         "seo" = EXCLUDED."seo",
         "updated_at" = now()`,
      [input.store.name.trim() || 'Мой магазин', input.store.description.trim() || null, seoJson],
    )
    revalidateTag('store-settings', 'max')
    const npKey = input.store.novaPoshtaApiKey.trim()
    if (npKey) {
      await pool.query(
        `UPDATE "delivery_methods" SET config = jsonb_set(COALESCE(config,'{}'::jsonb), '{apiKey}', to_jsonb($1::text)), is_active = true WHERE code = 'nova_poshta'`,
        [npKey],
      )
    }

    revalidatePath('/', 'layout')
    return { success: true as const }
  } catch (e) {
    return {
      success: false as const,
      error: e instanceof Error ? e.message : 'Не удалось выполнить установку',
    }
  }
}
