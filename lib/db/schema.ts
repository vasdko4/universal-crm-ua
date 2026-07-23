import {
  pgTable,
  serial,
  varchar,
  text,
  integer,
  bigint,
  numeric,
  boolean,
  timestamp,
  jsonb,
} from 'drizzle-orm/pg-core'

/** A choice axis on a product, e.g. Цвет / Размер / Память. */
export type ProductOption = {
  name: string
  type: 'color' | 'text'
  values: string[]
  // For color options: maps a value to a hex swatch, e.g. { 'Blue': '#1e3a5f' }.
  swatches?: Record<string, string>
}

/** A selected combination for a variant, e.g. { "Цвет": "Blue", "Память": "256 ГБ" }. */
export type VariantOptions = Record<string, string>

export const products = pgTable('products', {
  id: serial('id').primaryKey(),
  nameUk: varchar('name_uk', { length: 255 }),
  nameRu: varchar('name_ru', { length: 255 }),
  descriptionUk: text('description_uk'),
  descriptionRu: text('description_ru'),
  privateNotes: text('private_notes'),
  salesType: varchar('sales_type', { length: 20 }).default('retail'),
  sku: varchar('sku', { length: 100 }),
  barcode: varchar('barcode', { length: 100 }),
  // Stable numeric id of the source Prom.ua listing (from its product URL,
  // e.g. /ua/p123456789-slug.html). Prom.ua pages don't always show a SKU,
  // so SKU alone isn't a reliable re-import match key — this is. Null for
  // products not created via the Prom.ua importer.
  // bigint, not integer: Prom.ua's ids are ~10 digits (e.g. 3113652930),
  // which overflows a 32-bit integer (max 2,147,483,647) — every insert/
  // update used to fail with "value out of range for type integer".
  promId: bigint('prom_id', { mode: 'number' }),
  price: numeric('price', { precision: 10, scale: 2 }).notNull().default('0'),
  priceFrom: boolean('price_from').default(false),
  currency: varchar('currency', { length: 10 }).default('UAH'),
  oldPrice: numeric('old_price', { precision: 10, scale: 2 }),
  costPrice: numeric('cost_price', { precision: 10, scale: 2 }),
  quantity: integer('quantity').notNull().default(0),
  unit: varchar('unit', { length: 50 }).default('шт'),
  stockStatus: varchar('stock_status', { length: 50 }).default('В наличии'),
  siteGroupId: integer('site_group_id'),
  marketplaceCategoryId: integer('marketplace_category_id'),
  width: numeric('width', { precision: 10, scale: 2 }),
  height: numeric('height', { precision: 10, scale: 2 }),
  length: numeric('length', { precision: 10, scale: 2 }),
  weight: numeric('weight', { precision: 10, scale: 3 }),
  image: varchar('image', { length: 500 }),
  images: jsonb('images').$type<string[]>().default([]),
  sizes: jsonb('sizes').$type<string[]>().default([]),
  // Choice axes for variants, e.g. [{ name: 'Цвет', type: 'color', values: [...] }]
  options: jsonb('options').$type<ProductOption[]>().default([]),
  // Master switch for variant-based pricing/stock (color, size, etc.). When
  // false, the base price/quantity above are authoritative even if variant
  // rows exist in product_variants (e.g. temporarily disabled).
  variantsEnabled: boolean('variants_enabled').notNull().default(false),
  isVisible: boolean('is_visible').default(true),
  isInStock: boolean('is_in_stock').default(true),
  isPopular: boolean('is_popular').default(false),
  sortOrder: integer('sort_order').default(0),
  viewsCount: integer('views_count').default(0),
  ordersCount: integer('orders_count').default(0),
  // Admin-set addition to the displayed purchase count ("накрутка").
  // Shoppers see ordersCount + purchasesBoost.
  purchasesBoost: integer('purchases_boost').notNull().default(0),
  metaTitleUk: varchar('meta_title_uk', { length: 255 }),
  metaTitleRu: varchar('meta_title_ru', { length: 255 }),
  metaDescriptionUk: text('meta_description_uk'),
  metaDescriptionRu: text('meta_description_ru'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
})

// One purchasable combination of a product's options, with its own price/stock.
export const productVariants = pgTable('product_variants', {
  id: serial('id').primaryKey(),
  productId: integer('product_id')
    .notNull()
    .references(() => products.id, { onDelete: 'cascade' }),
  options: jsonb('options').$type<VariantOptions>().notNull().default({}),
  sku: varchar('sku', { length: 100 }),
  price: numeric('price', { precision: 10, scale: 2 }).notNull().default('0'),
  oldPrice: numeric('old_price', { precision: 10, scale: 2 }),
  quantity: integer('quantity').notNull().default(0),
  image: varchar('image', { length: 500 }),
  isInStock: boolean('is_in_stock').default(true),
  sortOrder: integer('sort_order').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

export const categories = pgTable('categories', {
  id: serial('id').primaryKey(),
  nameUk: varchar('name_uk', { length: 255 }).notNull(),
  nameRu: varchar('name_ru', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull(),
  descriptionUk: text('description_uk'),
  descriptionRu: text('description_ru'),
  type: varchar('type', { length: 20 }).default('general'),
  parentId: integer('parent_id'),
  image: varchar('image', { length: 255 }),
  isVisible: boolean('is_visible').default(true),
  sortOrder: integer('sort_order').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

export const productCategory = pgTable('product_category', {
  id: serial('id').primaryKey(),
  productId: integer('product_id').notNull(),
  categoryId: integer('category_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

export const productGroups = pgTable('product_groups', {
  id: serial('id').primaryKey(),
  nameUk: varchar('name_uk', { length: 255 }).notNull(),
  nameRu: varchar('name_ru', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull(),
  descriptionUk: text('description_uk'),
  descriptionRu: text('description_ru'),
  sortOrder: integer('sort_order').default(0),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

export const productGroupItems = pgTable('product_group_items', {
  id: serial('id').primaryKey(),
  productId: integer('product_id').notNull(),
  groupId: integer('group_id').notNull(),
  sortOrder: integer('sort_order').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

export const siteGroups = pgTable('site_groups', {
  id: serial('id').primaryKey(),
  nameUk: varchar('name_uk', { length: 255 }).notNull(),
  nameRu: varchar('name_ru', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull(),
  isActive: boolean('is_active').default(true),
  sortOrder: integer('sort_order').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

export const marketplaceCategories = pgTable('marketplace_categories', {
  id: serial('id').primaryKey(),
  nameUk: varchar('name_uk', { length: 255 }).notNull(),
  nameRu: varchar('name_ru', { length: 255 }).notNull(),
  parentId: integer('parent_id'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

export const importTasks = pgTable('import_tasks', {
  id: serial('id').primaryKey(),
  fileName: varchar('file_name', { length: 255 }).notNull(),
  sourceType: varchar('source_type', { length: 20 }).notNull().default('local'),
  status: varchar('status', { length: 20 }).default('pending'),
  totalItems: integer('total_items').default(0),
  processedItems: integer('processed_items').default(0),
  successItems: integer('success_items').default(0),
  failedItems: integer('failed_items').default(0),
  errorLog: text('error_log'),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  // Added for sourceType: 'prom' (Prom.ua shop import, app/actions/prom-import.ts).
  // Nullable/self-healed via ALTER TABLE IF NOT EXISTS so older installs don't
  // need a manual migration — see ensurePromImportColumns() there.
  sourceUrl: text('source_url'),
  // Resumable job state for a Prom.ua import: { shopUrl, origin, pending, capped }.
  state: jsonb('state'),
})

export const productCharacteristics = pgTable('product_characteristics', {
  id: serial('id').primaryKey(),
  productId: integer('product_id').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  value: text('value').notNull(),
  sortOrder: integer('sort_order').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

export const paymentGateways = pgTable('payment_gateways', {
  id: serial('id').primaryKey(),
  code: varchar('code', { length: 30 }).notNull().unique(),
  name: varchar('name', { length: 100 }).notNull(),
  isActive: boolean('is_active').default(false),
  isTestMode: boolean('is_test_mode').default(true),
  config: jsonb('config').notNull().default({}),
  sortOrder: integer('sort_order').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

export const payments = pgTable('payments', {
  id: serial('id').primaryKey(),
  gatewayCode: varchar('gateway_code', { length: 30 }).notNull(),
  orderReference: varchar('order_reference', { length: 100 }).notNull().unique(),
  invoiceId: varchar('invoice_id', { length: 150 }),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 10 }).notNull().default('UAH'),
  status: varchar('status', { length: 20 }).notNull().default('created'),
  description: text('description'),
  customerName: varchar('customer_name', { length: 255 }),
  customerEmail: varchar('customer_email', { length: 255 }),
  customerPhone: varchar('customer_phone', { length: 50 }),
  paymentUrl: text('payment_url'),
  refundedAmount: numeric('refunded_amount', { precision: 12, scale: 2 }).notNull().default('0'),
  // Real fiscal check URL, when the gateway's API actually returns one for
  // this transaction (WayForPay/Monobank card payments with fiscalization
  // enabled on the merchant's account). Null when unavailable — the order
  // receipt then falls back to a non-fiscal QR pointing at the store.
  receiptUrl: text('receipt_url'),
  rawResponse: jsonb('raw_response'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

export const paymentEvents = pgTable('payment_events', {
  id: serial('id').primaryKey(),
  paymentId: integer('payment_id').notNull(),
  type: varchar('type', { length: 30 }).notNull(),
  status: varchar('status', { length: 20 }),
  amount: numeric('amount', { precision: 12, scale: 2 }),
  message: text('message'),
  payload: jsonb('payload'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

export const deliveryMethods = pgTable('delivery_methods', {
  id: serial('id').primaryKey(),
  code: varchar('code', { length: 30 }).notNull().unique(),
  name: varchar('name', { length: 100 }).notNull(),
  isActive: boolean('is_active').default(true),
  isRemovable: boolean('is_removable').default(true),
  config: jsonb('config').notNull().default({}),
  sortOrder: integer('sort_order').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

export const paymentMethods = pgTable('payment_methods', {
  id: serial('id').primaryKey(),
  code: varchar('code', { length: 30 }).notNull().unique(),
  name: varchar('name', { length: 100 }).notNull(),
  isActive: boolean('is_active').default(true),
  config: jsonb('config').notNull().default({}),
  sortOrder: integer('sort_order').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

export const customers = pgTable('customers', {
  id: serial('id').primaryKey(),
  firstName: varchar('first_name', { length: 150 }).notNull(),
  lastName: varchar('last_name', { length: 150 }),
  phone: varchar('phone', { length: 50 }).notNull(),
  email: varchar('email', { length: 255 }),
  reliabilityScore: integer('reliability_score').notNull().default(100),
  ordersCount: integer('orders_count').notNull().default(0),
  totalTurnover: numeric('total_turnover', { precision: 12, scale: 2 }).notNull().default('0'),
  lastOrderDate: timestamp('last_order_date', { withTimezone: true }),
  tags: jsonb('tags').notNull().default([]),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
})

export const customerContacts = pgTable('customer_contacts', {
  id: serial('id').primaryKey(),
  customerId: integer('customer_id').notNull(),
  type: varchar('type', { length: 30 }).notNull(),
  value: varchar('value', { length: 255 }).notNull(),
  sortOrder: integer('sort_order').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

export const promotions = pgTable('promotions', {
  id: serial('id').primaryKey(),
  type: varchar('type', { length: 20 }).notNull().default('promocode'),
  name: varchar('name', { length: 255 }).notNull(),
  discountType: varchar('discount_type', { length: 20 }).notNull().default('percentage'),
  discountValue: numeric('discount_value', { precision: 12, scale: 2 }).notNull().default('0'),
  promoCode: varchar('promo_code', { length: 80 }),
  targetType: varchar('target_type', { length: 20 }).notNull().default('all'),
  targetGroupIds: jsonb('target_group_ids').notNull().default([]),
  targetProductIds: jsonb('target_product_ids').notNull().default([]),
  usageLimit: integer('usage_limit'),
  minOrderAmount: numeric('min_order_amount', { precision: 12, scale: 2 }),
  noStacking: boolean('no_stacking').notNull().default(false),
  excludeWholesale: boolean('exclude_wholesale').notNull().default(false),
  startsAt: timestamp('starts_at', { withTimezone: true }).notNull().defaultNow(),
  endsAt: timestamp('ends_at', { withTimezone: true }),
  isActive: boolean('is_active').notNull().default(true),
  usedCount: integer('used_count').notNull().default(0),
  totalOrdersAmount: numeric('total_orders_amount', { precision: 14, scale: 2 }).notNull().default('0'),
  totalDiscountAmount: numeric('total_discount_amount', { precision: 14, scale: 2 }).notNull().default('0'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

// Модальная реклама (попапы) на витрине: баннер с настройками показа,
// таргетингом по страницам и встроенной аналитикой (показы/клики/закрытия).
export const modalAds = pgTable('modal_ads', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  body: text('body'),
  imageUrl: varchar('image_url', { length: 500 }),
  buttonText: varchar('button_text', { length: 120 }),
  buttonUrl: varchar('button_url', { length: 500 }),
  // Hex color of the CTA button ('' = theme primary color)
  buttonColor: varchar('button_color', { length: 20 }).notNull().default(''),
  // Where the popup appears: all | home | catalog | product | cart
  targetPages: jsonb('target_pages').notNull().default(['all']),
  // How the popup is triggered: delay | scroll | exit
  triggerType: varchar('trigger_type', { length: 20 }).notNull().default('delay'),
  // delay: seconds before showing; scroll: percent of page scrolled
  triggerValue: integer('trigger_value').notNull().default(5),
  // Frequency capping: every | session | days
  frequency: varchar('frequency', { length: 20 }).notNull().default('session'),
  // For frequency=days: show again after N days
  frequencyDays: integer('frequency_days').notNull().default(7),
  // Visual size of the modal: small | medium | large
  size: varchar('size', { length: 20 }).notNull().default('medium'),
  startsAt: timestamp('starts_at', { withTimezone: true }).notNull().defaultNow(),
  endsAt: timestamp('ends_at', { withTimezone: true }),
  isActive: boolean('is_active').notNull().default(true),
  // Denormalized analytics counters
  viewsCount: integer('views_count').notNull().default(0),
  clicksCount: integer('clicks_count').notNull().default(0),
  closesCount: integer('closes_count').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

// Журнал действий в админ-центре: кто, что и когда сделал (вход, изменение
// товара, настройки и т.д.). Используется вкладкой «Логи» для аудита.
export const adminLogs = pgTable('admin_logs', {
  id: serial('id').primaryKey(),
  userId: text('user_id'),
  userName: varchar('user_name', { length: 255 }),
  userEmail: varchar('user_email', { length: 255 }),
  // login | create | update | delete | toggle | settings | security
  action: varchar('action', { length: 30 }).notNull(),
  // e.g. product, order, user, settings, modal_ad, auth
  entity: varchar('entity', { length: 50 }).notNull(),
  entityId: varchar('entity_id', { length: 100 }),
  details: text('details'),
  ip: varchar('ip', { length: 100 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

// Брошенные корзины: посетитель начал оформление (ввёл контакты на чекауте),
// но не завершил заказ. Админ видит список и может отправить напоминание.
export const abandonedCarts = pgTable('abandoned_carts', {
  id: serial('id').primaryKey(),
  // Random client-side token so the same visitor updates one row, not many.
  token: varchar('token', { length: 64 }).notNull().unique(),
  customerName: varchar('customer_name', { length: 255 }),
  customerPhone: varchar('customer_phone', { length: 50 }),
  customerEmail: varchar('customer_email', { length: 255 }),
  // Snapshot of cart lines: [{ productId, name, price, quantity, image }]
  items: jsonb('items').notNull().default([]),
  itemsTotal: numeric('items_total', { precision: 12, scale: 2 }).notNull().default('0'),
  itemsCount: integer('items_count').notNull().default(0),
  // open -> reminded -> recovered (order placed) | dismissed (admin hid it)
  status: varchar('status', { length: 20 }).notNull().default('open'),
  remindedAt: timestamp('reminded_at', { withTimezone: true }),
  recoveredOrderNumber: varchar('recovered_order_number', { length: 100 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

export const promotionUsages = pgTable('promotion_usages', {
  id: serial('id').primaryKey(),
  promotionId: integer('promotion_id').notNull(),
  orderReference: varchar('order_reference', { length: 100 }),
  orderAmount: numeric('order_amount', { precision: 12, scale: 2 }).notNull().default('0'),
  discountAmount: numeric('discount_amount', { precision: 12, scale: 2 }).notNull().default('0'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

export const pages = pgTable('pages', {
  id: serial('id').primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  titleRu: varchar('title_ru', { length: 255 }),
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  content: text('content'),
  contentRu: text('content_ru'),
  excerpt: text('excerpt'),
  excerptRu: text('excerpt_ru'),
  coverImage: varchar('cover_image', { length: 500 }),
  template: varchar('template', { length: 30 }).notNull().default('default'),
  status: varchar('status', { length: 20 }).notNull().default('draft'),
  showInMenu: boolean('show_in_menu').notNull().default(false),
  menuTitle: varchar('menu_title', { length: 150 }),
  sortOrder: integer('sort_order').notNull().default(0),
  metaTitle: varchar('meta_title', { length: 255 }),
  metaDescription: text('meta_description'),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

export const articleCategories = pgTable('article_categories', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 150 }).notNull(),
  slug: varchar('slug', { length: 150 }).notNull().unique(),
  description: text('description'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

export const articles = pgTable('articles', {
  id: serial('id').primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  categoryId: integer('category_id'),
  excerpt: text('excerpt'),
  content: text('content'),
  coverImage: varchar('cover_image', { length: 500 }),
  author: varchar('author', { length: 150 }),
  tags: jsonb('tags').notNull().default([]),
  status: varchar('status', { length: 20 }).notNull().default('draft'),
  isFeatured: boolean('is_featured').notNull().default(false),
  viewsCount: integer('views_count').notNull().default(0),
  readingMinutes: integer('reading_minutes').notNull().default(1),
  metaTitle: varchar('meta_title', { length: 255 }),
  metaDescription: text('meta_description'),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

export const productReviews = pgTable('product_reviews', {
  id: serial('id').primaryKey(),
  productId: integer('product_id').notNull(),
  authorName: varchar('author_name', { length: 150 }).notNull(),
  authorEmail: varchar('author_email', { length: 255 }),
  rating: integer('rating').notNull().default(5),
  title: varchar('title', { length: 255 }),
  body: text('body').notNull(),
  pros: text('pros'),
  cons: text('cons'),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  isVerifiedPurchase: boolean('is_verified_purchase').notNull().default(false),
  adminReply: text('admin_reply'),
  helpfulCount: integer('helpful_count').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

export const productQuestions = pgTable('product_questions', {
  id: serial('id').primaryKey(),
  productId: integer('product_id').notNull(),
  authorName: varchar('author_name', { length: 150 }).notNull(),
  authorEmail: varchar('author_email', { length: 255 }),
  question: text('question').notNull(),
  answer: text('answer'),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  answeredAt: timestamp('answered_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

export const roles = pgTable('roles', {
  id: serial('id').primaryKey(),
  code: varchar('code', { length: 40 }).notNull().unique(),
  name: varchar('name', { length: 120 }).notNull(),
  description: text('description'),
  permissions: jsonb('permissions').notNull().default([]),
  isSystem: boolean('is_system').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

export const orders = pgTable('orders', {
  id: serial('id').primaryKey(),
  orderNumber: varchar('order_number', { length: 30 }).notNull().unique(),
  status: varchar('status', { length: 20 }).notNull().default('new'),
  customerId: integer('customer_id'),
  customerName: varchar('customer_name', { length: 255 }),
  customerPhone: varchar('customer_phone', { length: 50 }),
  customerEmail: varchar('customer_email', { length: 255 }),
  deliveryMethod: varchar('delivery_method', { length: 40 }),
  deliveryCity: varchar('delivery_city', { length: 255 }),
  deliveryBranch: varchar('delivery_branch', { length: 255 }),
  deliveryAddress: text('delivery_address'),
  trackingNumber: varchar('tracking_number', { length: 100 }),
  deliveryStatus: varchar('delivery_status', { length: 100 }),
  paymentMethod: varchar('payment_method', { length: 40 }),
  paymentStatus: varchar('payment_status', { length: 20 }).notNull().default('unpaid'),
  itemsTotal: numeric('items_total', { precision: 12, scale: 2 }).notNull().default('0'),
  deliveryCost: numeric('delivery_cost', { precision: 12, scale: 2 }).notNull().default('0'),
  discountTotal: numeric('discount_total', { precision: 12, scale: 2 }).notNull().default('0'),
  promoCode: varchar('promo_code', { length: 80 }),
  total: numeric('total', { precision: 12, scale: 2 }).notNull().default('0'),
  itemsCount: integer('items_count').notNull().default(0),
  currency: varchar('currency', { length: 10 }).notNull().default('UAH'),
  tags: jsonb('tags').notNull().default([]),
  note: text('note'),
  createdBy: text('created_by'),
  userId: text('user_id'),
  // True once stock has been restored for this (cancelled) order, so
  // toggling the status back and forth never double-counts the restock.
  stockRestored: boolean('stock_restored').notNull().default(false),
  // Marketing attribution captured from the ?utm_* query params present when
  // the customer landed on the site (last-touch: whichever campaign link was
  // most recently opened before checkout). Populated from a client-side
  // cookie at order creation time — see lib/shop/utm.ts. Null when the
  // visitor arrived with no UTM params (direct traffic, organic, etc).
  utmSource: varchar('utm_source', { length: 150 }),
  utmMedium: varchar('utm_medium', { length: 150 }),
  utmCampaign: varchar('utm_campaign', { length: 150 }),
  utmTerm: varchar('utm_term', { length: 150 }),
  utmContent: varchar('utm_content', { length: 150 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

export const orderItems = pgTable('order_items', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id').notNull(),
  productId: integer('product_id'),
  variantId: integer('variant_id'),
  variantLabel: varchar('variant_label', { length: 255 }),
  name: varchar('name', { length: 255 }).notNull(),
  sku: varchar('sku', { length: 100 }),
  image: varchar('image', { length: 500 }),
  price: numeric('price', { precision: 12, scale: 2 }).notNull().default('0'),
  // Purchase-cost snapshot taken at order time, so profit stays accurate even
  // if the product's cost price changes later.
  costPrice: numeric('cost_price', { precision: 12, scale: 2 }),
  quantity: integer('quantity').notNull().default(1),
  total: numeric('total', { precision: 12, scale: 2 }).notNull().default('0'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  })

export const orderHistory = pgTable('order_history', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id').notNull(),
  type: varchar('type', { length: 30 }).notNull(),
  message: text('message').notNull(),
  actor: varchar('actor', { length: 150 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

export const storeSettings = pgTable('store_settings', {
  id: integer('id').primaryKey().default(1),
  storeName: varchar('store_name', { length: 255 }).notNull().default('Мой магазин'),
  storeDescription: text('store_description'),
  logoUrl: varchar('logo_url', { length: 500 }),
  faviconUrl: varchar('favicon_url', { length: 500 }),
  openCartAfterAdd: boolean('open_cart_after_add').notNull().default(true),
  defaultLocale: varchar('default_locale', { length: 5 }).notNull().default('uk'),
  activeTemplate: varchar('active_template', { length: 30 }).notNull().default('classic'),
  social: jsonb('social').notNull().default({}),
  googleAds: jsonb('google_ads').notNull().default({}),
  emailSettings: jsonb('email_settings').notNull().default({}),
  contact: jsonb('contact').notNull().default({}),
  seo: jsonb('seo').notNull().default({}),
  // Уведомления о заказах: email админа + Telegram-бот.
  notifications: jsonb('notifications').notNull().default({}),
  // Вход через Google: OAuth Client ID/Secret, настраивается в админ-центре.
  googleAuth: jsonb('google_auth').notNull().default({}),
  // Hero-блок главной страницы (тексты uk/ru + картинка), Настройки → Главная.
  homeHero: jsonb('home_hero').notNull().default({}),
  // Доп. поля Google Merchant Center фида (категория товара, ставка доставки)
  // — Настройки → Google Ads. См. app/feed/google-merchant.xml/route.ts.
  merchantFeed: jsonb('merchant_feed').notNull().default({}),
  // Минимальная сумма заказа: можно включить/выключить и задать порог,
  // ниже которого оформление заказа на чекауте блокируется.
  minOrder: jsonb('min_order').notNull().default({}),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

export const analyticsEvents = pgTable('analytics_events', {
  id: serial('id').primaryKey(),
  type: varchar('type', { length: 30 }).notNull(),
  path: varchar('path', { length: 500 }),
  productId: integer('product_id'),
  orderId: integer('order_id'),
  amount: numeric('amount', { precision: 12, scale: 2 }),
  sessionId: varchar('session_id', { length: 80 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

export type Role = typeof roles.$inferSelect
export type Order = typeof orders.$inferSelect
export type OrderItem = typeof orderItems.$inferSelect
export type OrderHistoryEntry = typeof orderHistory.$inferSelect
export type StoreSettingsRow = typeof storeSettings.$inferSelect

export type Page = typeof pages.$inferSelect
export type ArticleCategory = typeof articleCategories.$inferSelect
export type Article = typeof articles.$inferSelect
export type ProductReview = typeof productReviews.$inferSelect
export type ProductQuestion = typeof productQuestions.$inferSelect

export type Promotion = typeof promotions.$inferSelect
export type ModalAd = typeof modalAds.$inferSelect
export type AdminLog = typeof adminLogs.$inferSelect
export type AbandonedCart = typeof abandonedCarts.$inferSelect
export type PromotionUsage = typeof promotionUsages.$inferSelect

export type Customer = typeof customers.$inferSelect
export type CustomerContact = typeof customerContacts.$inferSelect

export type PaymentGateway = typeof paymentGateways.$inferSelect
export type Payment = typeof payments.$inferSelect
export type PaymentEvent = typeof paymentEvents.$inferSelect
export type DeliveryMethod = typeof deliveryMethods.$inferSelect
export type PaymentMethod = typeof paymentMethods.$inferSelect

export type Product = typeof products.$inferSelect
export type Category = typeof categories.$inferSelect
export type ProductGroup = typeof productGroups.$inferSelect
export type SiteGroup = typeof siteGroups.$inferSelect
export type MarketplaceCategory = typeof marketplaceCategories.$inferSelect
export type ImportTask = typeof importTasks.$inferSelect
export type ProductCharacteristic = typeof productCharacteristics.$inferSelect
