const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  // Next.js emits inline boot scripts; Google Ads/GA load gtag.js.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com https://www.googleadservices.com https://googleads.g.doubleclick.net https://www.google.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com https://www.google.com https://www.googleadservices.com https://googleads.g.doubleclick.net https://stats.g.doubleclick.net https://region1.google-analytics.com https://images.prom.ua https://*.prom.ua https://*.prom.st https://*.vercel-storage.com https://*.blob.vercel-storage.com https://vitals.vercel-insights.com",
  "frame-src https://www.google.com https://www.googletagmanager.com https://td.doubleclick.net",
  'upgrade-insecure-requests',
].join('; ')

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
    // here. Prom photos used to go through `/api/media?src=…`; listing/gallery
    // now hit Prom via remotePatterns so the optimizer is one hop, not two.
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
          { key: 'Content-Security-Policy', value: CONTENT_SECURITY_POLICY },
        ],
      },
    ]
  },
}

export default nextConfig
