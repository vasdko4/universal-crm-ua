import { withSentryConfig } from '@sentry/nextjs'

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone output copies only the pruned production node_modules + server
  // into .next/standalone, so the Docker image doesn't need the full
  // pnpm/workspace tree at runtime — keeps the runtime image small.
  output: 'standalone',
  // Serve modern formats and let Next resize/compress images for faster LCP.
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      { protocol: 'https', hostname: '*.public.blob.vercel-storage.com' },
      { protocol: 'https', hostname: '*.blob.vercel-storage.com' },
      { protocol: 'https', hostname: 'images.prom.ua' },
      { protocol: 'https', hostname: '*.prom.st' },
    ],
  },
  // Smaller client bundles: only pull the icons/components actually used.
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  // Long-lived caching for hashed static assets + security headers.
  async headers() {
    return [
      {
        source: '/products/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' }],
      },
      {
        // Security headers for every page. frame-ancestors is intentionally
        // NOT set here so the v0 preview iframe keeps working; on production
        // hosting add Content-Security-Policy frame-ancestors 'none' at the
        // proxy level if clickjacking protection for the admin is required.
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
        ],
      },
      {
        // Admin center + auth pages hold real credentials/actions and are
        // never meant to be embedded anywhere — block clickjacking here
        // regardless of the v0 preview exception above.
        source: '/(admin|sign-in|setup)/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
        ],
      },
    ]
  },
}

// withSentryConfig only uploads source maps / creates releases when
// SENTRY_AUTH_TOKEN + SENTRY_ORG + SENTRY_PROJECT are set (e.g. in CI); it's
// a harmless no-op wrapper otherwise, safe to build/run without any of them.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
  webpack: { treeshake: { removeDebugLogging: true } },
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
})
