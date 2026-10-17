export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      const { ensureSetupToken } = await import('./lib/setup-token')
      const { generated } = ensureSetupToken()
      if (generated) {
        console.log(
          '[setup] one-time install token written to .setup-token — open /setup and paste it. Do not put the token in URLs or logs.',
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
    // Prom.ua sync scheduler: minute tick, runs the catalog sync when due
    // (integration enabled + interval elapsed). Out of the box — no system
    // crontab needed on the VPS. Never throws, never blocks startup.
    try {
      const { startPromScheduler } = await import('./lib/prom/scheduler')
      startPromScheduler()
    } catch (e) {
      console.error('[prom-scheduler]', (e as Error).message)
    }
    // Generic cron scheduler: minute tick, runs due jobs from the cron
    // registry (admin Cron tab toggles). Same deal — no system crontab
    // needed on the VPS. Never throws, never blocks startup.
    try {
      const { startCronScheduler } = await import('./lib/cron/scheduler')
      startCronScheduler()
    } catch (e) {
      console.error('[cron-scheduler]', (e as Error).message)
    }
  }
}
