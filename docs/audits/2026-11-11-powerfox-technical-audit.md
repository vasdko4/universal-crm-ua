# Powerfox technical audit — 2026-11-11

## Scope and evidence
- Code: commit `defa90d` on branch `audit/seo-ads-merchant-hardening`.
- Public checks: `https://powerfox.shop/`, `/robots.txt`, `/sitemap.xml`, and `/feed/google-merchant.xml`.
- No production settings, Google Ads settings, or Merchant Center settings were changed.

## Implemented (high impact / low effort)
**Home-page image priority contention.** The homepage rendered its hero plus the initial product grid with `fetchpriority=high`; the live home page exposed five image preloads. The "all products" grid appears below the hero and popular-products section, so its two high-priority images competed with the LCP image. `InfiniteProducts` now exposes `priorityInitialImages` (default `true` for catalog pages) and the home page passes `false`.

## Confirmed public state
| Area | Observation | Status |
|---|---|---|
| Crawl discovery | `/robots.txt` returns 200 and names `https://powerfox.shop/sitemap.xml`; sitemap contains 484 URL entries. | Good |
| Canonical/schema | Home page returns 200, canonical `https://powerfox.shop`, and two JSON-LD blocks. | Good |
| Transport/browser defenses | Home response has CSP and HSTS. | Good |
| Merchant feed | Feed returns 200 with 164 product rows and 164 primary images. | Good |
| Merchant identifiers | Feed currently has 0 `g:gtin` and 152 `g:mpn` values. | Data-quality action required |
| Caching | Home response is `private, no-store`; this prevents CDN reuse for anonymous traffic. | Measure and redesign before enabling shared caching |

## Priority backlog
### P0 — measurement correctness
The code sends a browser GA4 `purchase` and separately sends a Measurement Protocol `purchase` after payment. The module explicitly documents that both are counted. Do **not** turn on `GA4_MEASUREMENT_ID` / `GA4_API_SECRET` until an attribution/deduplication design is deployed: persist an allowed GA client identifier at checkout, use a stable event ID, and validate one purchase per `transaction_id` in GA4 DebugView and BigQuery/Explorations. Keep the existing Google Ads offline conversion path as a separately configured conversion action; do not count it together with the browser action as two primary purchase goals.

### P0 — Merchant eligibility data
For every manufacturer-issued GTIN, enter the real GTIN in the product barcode field and validate against supplier data. Do not relabel internal SKUs as GTINs. Keep `brand + mpn` for items without a GTIN and `identifier_exists=no` only for genuinely identifier-less products. Reprocess the feed and resolve all Diagnostics disapprovals before raising spend.

### P1 — Core Web Vitals/cache
Profile the live site in PageSpeed Insights and CrUX by template. The anonymous storefront is fully dynamic/no-store, likely raising TTFB under load. Split public catalogue/product reads from cookie-dependent layout features, then use tagged ISR/CDN caching with revalidation on inventory, price, and content mutations. Do not cache cart, account, checkout, or personalized responses.

### P1 — Google Ads and consent
Use one primary paid-order conversion action, a value/currency, transaction ID, consent mode v2, and enhanced conversions only after the privacy notice, consent UX, and Google Ads configuration are reviewed. Verify `view_item`, `add_to_cart`, `begin_checkout`, payment/shipping and purchase in Tag Assistant + GA4 DebugView. Import only the validated primary event for bidding.

### P1 — SEO/index quality
In Search Console, submit the sitemap, monitor Page Indexing, Merchant listing reports and URL Inspection for product/category templates. Check that Ukrainian and Russian pages have materially localized titles/descriptions/content; keep equivalent language alternates, not duplicate near-identical pages. Maintain truthful availability/price matching product pages and feed.

### P2 — reviews/trust/admin
Request post-purchase reviews from verified buyers with a neutral invitation; publish both positive and negative reviews under a visible moderation policy. Seller/Product Ratings depend on Google program eligibility and verified collection—there is no compliant way to manufacture them. Add an admin health panel for feed row count, missing GTIN/brand/MPN/image, stale product price/availability, and event-delivery failures.

## Deployment and control
1. Review this branch and merge only after CI passes.
2. Deploy to staging; compare home-page HTML/network waterfall and confirm the below-fold all-products cards are lazy, while catalogue first-row images remain prioritized.
3. Deploy normally; do not change Ads, GA4 Measurement Protocol, consent, or Merchant Center configuration in this release.
4. After release, monitor CWV (LCP/INP/CLS), server TTFB, Search Console coverage, Merchant Diagnostics, checkout success rate, and paid-order reconciliation daily for seven days.
5. Roll back with the supplied script or `git revert` of the merge commit if an unexpected storefront regression appears.
