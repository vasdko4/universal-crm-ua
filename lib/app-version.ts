import pkg from '@/package.json'

/**
 * The app's own version, straight from package.json — bundled in at build
 * time (Next.js inlines static JSON imports), so it always matches whatever
 * code was actually built, with no env var/CI plumbing required.
 *
 * IMPORTANT: bump the "version" field in package.json to match the git tag
 * in the same commit/PR that cuts a release (see docs/releasing or ask
 * Viktor) — otherwise the "Обновления" admin page (/admin/updates) will show
 * a stale current version.
 */
export const APP_VERSION: string = pkg.version
