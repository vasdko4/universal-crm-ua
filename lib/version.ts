/**
 * Minimal semver-ish helpers for comparing app release versions (tags like
 * `v1.0.14` / `1.0.14`). Deliberately simple — this app only ever produces
 * `MAJOR.MINOR.PATCH` tags via `.github/workflows/release.yml`, no
 * prerelease/build metadata to worry about.
 */

export function normalizeVersion(raw: string): string {
  return raw.trim().replace(/^v/i, '')
}

function parseParts(v: string): number[] {
  return normalizeVersion(v)
    .split('.')
    .map((p) => {
      const n = parseInt(p, 10)
      return Number.isFinite(n) ? n : 0
    })
}

/** true if `latest` is a strictly newer version than `current`. */
export function isNewerVersion(latest: string, current: string): boolean {
  const a = parseParts(latest)
  const b = parseParts(current)
  const len = Math.max(a.length, b.length)
  for (let i = 0; i < len; i++) {
    const x = a[i] ?? 0
    const y = b[i] ?? 0
    if (x > y) return true
    if (x < y) return false
  }
  return false
}
