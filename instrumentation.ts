export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      const { ensureSetupToken } = await import('./lib/setup-token')
      const { generated } = ensureSetupToken()
      if (generated) {
        // On Vercel the token is in-memory only (no writable .setup-token),
        // so say so instead of pointing the admin at a file that was never written.
        console.log(
          process.env.VERCEL
            ? '[setup] one-time install token generated for this instance only — set the SETUP_TOKEN env var for /setup on a fresh install. Do not put the token in URLs or logs.'
            : '[setup] one-time install token written to .setup-token — open /setup and paste it. Do not put the token in URLs or logs.',
        )
      }
    } catch (e) {
      console.error('[setup-token]', (e as Error).message)
    }
    // Idempotent: hide leftover demo SKUs and fold Prom's electronics root
    // onto the seeded category. Runs in the background so it never delays
    // the cold start — if the instance is frozen mid-run, the idempotent
    // retry on the next cold start picks up where it left off. Failures
    // must not take the process down.
    try {
      const { runCatalogHygiene } = await import('./lib/shop/catalog-hygiene')
      runCatalogHygiene().catch((e) => console.error('[catalog-hygiene]', (e as Error).message))
    } catch (e) {
      console.error('[catalog-hygiene]', (e as Error).message)
    }
  }
}
