export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Idempotent: hide leftover demo SKUs and fold Prom's electronics root
    // onto the seeded category. Failures must not take the process down.
    try {
      const { runCatalogHygiene } = await import('./lib/shop/catalog-hygiene')
      await runCatalogHygiene()
    } catch (e) {
      console.error('[catalog-hygiene]', (e as Error).message)
    }
  }
}
