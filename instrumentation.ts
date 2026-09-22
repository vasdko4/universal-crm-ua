export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      const { ensureSetupToken } = await import('./lib/setup-token')
      const { token, generated } = ensureSetupToken()
      if (generated) {
        console.log(`[setup] one-time install token (open /setup?token=…): ${token}`)
      }
    } catch (e) {
      console.error('[setup-token]', (e as Error).message)
    }
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
