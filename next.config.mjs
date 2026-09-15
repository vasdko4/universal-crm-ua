/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  // Standalone output copies only the pruned production node_modules + server
  // into .next/standalone, so the Docker image doesn't need the full
  // pnpm/workspace tree at runtime — keeps the runtime image small.
  // Vercel has its own packager; `output: 'standalone'` there can produce
  // "invalid deployment package" / patch_build_4xx failures. GitHub Actions
  // e2e also skips it — Turbopack standalone trips over the sharp native
  // binary under pnpm. Docker builds with `next build --webpack` so standalone
  // tracing of libvips works (see Dockerfile).
  ...(process.env.VERCEL || process.env.CI ? {} : { output: 'standalone' }),
  // Serve modern formats and let Next resize/compress images for faster LCP.
  images: {
    formats: ['image/avif', 'image/webp'],
    qualities: [70, 75, 85, 90, 95],
    // Next 16 blocks local <Image src> with a query string unless listed
    // here. Listing/gallery Prom photos go through `/api/media?src=…` so the
    // HTML never names images.prom.ua. remotePatterns stay for Blob/Unsplash.
    localPatterns: [
      { pathname: '/api/media' },
      { pathname: '/api/email-image' },
      { pathname: '/uploads/**' },
      { pathname: '/images/**' },
      { pathname: '/products/**' },
      { pathname: '/placeholder.svg' },
      { pathname: '/hero-electronics.png' },
      { pathname: '/promotions-empty.png' },
      { pathname: '/icon.png' },
    ],
    remotePatterns: [
      { protocol: 'https', hostname: '*.public.blob.vercel-storage.com' },
      { protocol: 'https', hostname: '*.blob.vercel-storage.com' },
      { protocol: 'https', hostname: 'images.prom.ua' },
      { protocol: 'https', hostname: '*.prom.ua' },
      { protocol: 'https', hostname: 'cdn.prom.st' },
      { protocol: 'https', hostname: '*.prom.st' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  async rewrites() {
    return [{ source: '/favicon.ico', destination: '/icon.png' }]
  },

  ...(process.env.VERCEL
    ? {}
    : {
        outputFileTracingIncludes: {
          '/api/admin/upload': [
            './node_modules/.pnpm/@img+sharp-libvips-*/node_modules/@img/**',
            './node_modules/.pnpm/@img+sharp-linux*/node_modules/@img/**',
            './node_modules/.pnpm/@img+sharp-linuxmusl*/node_modules/@img/**',
          ],
        },
      }),
  outputFileTracingExcludes: {
    '/uploads/[...path]': ['./app/uploads/[...path]/serve-local.ts', './public/uploads/**'],
  },

  async headers() {
    return [
      {
        source: '/products/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' }],
      },
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
    ]
  },
}

export default nextConfig
