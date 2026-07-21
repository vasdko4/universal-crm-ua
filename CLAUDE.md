# CLAUDE.md

This file provides guidance to AI coding assistants working with code in this
repository.

> Note: an earlier version of this file described a PHP 8.3/MySQL prototype.
> That prototype was abandoned; nothing in this repo runs PHP or MySQL
> anymore (the leftover `config.php` / `migrate.php` / `includes/*.php` files
> have been removed). This file now describes the actual, shipped app below.

## Project Overview

"Techno Store" / PowerFox — a Ukrainian-market e-commerce storefront + admin
CRM built with **Next.js 16 (App Router)**, **PostgreSQL** via **Drizzle ORM**,
and **Better Auth**. TypeScript throughout, Tailwind v4 for styling.

- Storefront: `app/(shop)/` — catalog, product/category pages, cart, checkout,
  articles, account.
- Admin CRM: `app/admin/` — products, orders, customers, promotions, reviews,
  settings (incl. Google Ads, SEO, email, delivery, payments), statistics.
- Server actions in `app/actions/*.ts` are the primary read/write layer (not a
  REST API) — pages and admin UI call them directly.
- A few `app/api/*` routes exist for webhooks/integrations (payments,
  cron, auth, search, health, track).

## Local Development

```bash
pnpm setup       # one-command: env + deps + Docker Postgres + full DB snapshot
pnpm dev         # dev server
pnpm build       # production build
pnpm test        # vitest
```

See `README.local.md` / `УСТАНОВКА.txt` for the full install matrix (Docker,
manual Postgres, or `scripts/vps-install.sh` for a clean production VPS).

## Database

- Schema + queries: `lib/db/schema.ts` (Drizzle table defs), `lib/db/index.ts`
  (pool + drizzle client), `lib/shop/queries.ts` (storefront reads).
- **No ORM migration tool is used** — schema changes are plain SQL:
  - `db/schema.sql` — full schema for a fresh empty install.
  - `db/dump.sql` — full schema + all current demo data (used by the default
    `pnpm setup` / `db:restore` path).
  - `db/migrate.sql` + `migrations/00N_*.sql` — additive, idempotent
    (`ADD COLUMN IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS`) changes to
    bring an existing production database up to date without touching data.
  - When you add/change a column or index, update **all three**: `schema.sql`,
    `dump.sql`, and a new `migrations/00N_*.sql` (+ append to `db/migrate.sql`).
- Products, categories, pages, articles etc. store **uk/ru bilingual pairs**
  as separate columns (`name_uk`/`name_ru`, not a JSON blob); UI falls back to
  `uk` when `ru` is missing.
- Soft delete: products use `deleted_at` (never hard-delete in normal flows);
  the admin Trash page restores/empties them.

## Site URL / Domain Resolution (important — past bug)

Two ways to resolve the public origin exist in `lib/seo.ts`:
- `getSiteUrl()` / `absoluteUrl()` — **env vars only** (`NEXT_PUBLIC_SITE_URL` →
  `BETTER_AUTH_URL` → `VERCEL_URL` → localhost).
- `getCanonicalSiteUrl()` / `canonicalUrl()` / `toAbsolute()` — **prefers the
  domain set in admin Настройки → SEO**, falling back to the env-only
  resolution. This is what `sitemap.ts`, `robots.ts` and the root
  `app/layout.tsx` metadataBase use.

**Always use the `canonical*` versions on any page users can visit** (product,
category, catalog, article, home, etc.) so canonical links / JSON-LD / OG data
agree with sitemap.xml and robots.txt. Using the env-only versions caused a
real bug where every shop page pointed at `localhost` while the sitemap
correctly used the admin-configured domain — fixed 2026-07, don't reintroduce it.

## Google Ads

`components/shop/google-ads.tsx` — `GoogleAdsTag` (base gtag, rendered once in
the shop layout when Настройки → Google Ads has a conversion ID) and
`GoogleAdsPurchase` (fires the purchase conversion on the order-confirmation
page only, deduped per order via sessionStorage). Don't add gtag to admin
pages.

## Performance Notes (matters on small VPS deployments)

- Add an index whenever you introduce a new `WHERE`/`JOIN` column that's
  queried on a storefront hot path (product/category pages) — see
  `migrations/005_performance_indexes.sql` for the pattern and rationale
  (missing indexes on `product_category.category_id` and
  `product_reviews/product_questions.product_id` caused full scans there).
- `scripts/vps-install.sh` provisions a swapfile automatically on <4GB RAM
  hosts because `pnpm build` can need 1.5-2GB+; keep that logic if you modify
  the install script.

## File Uploads / Images

Local uploads go to `/uploads` (gitignored, served by Next). The demo dataset
uses Vercel Blob URLs (`@vercel/blob`) for product images; `next.config.mjs`
`images.remotePatterns` whitelists Blob + `images.prom.ua`/`*.prom.st`
(prom.ua import source). Add new external image hosts there.

## Testing

`pnpm test` runs Vitest unit tests in `tests/*.test.ts` (pure functions:
slugs, phone formatting, templates, permissions, formatting). There's no
end-to-end test suite; verify page-level changes by running the dev server
against a restored DB snapshot.
