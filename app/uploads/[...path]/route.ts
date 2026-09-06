import { type NextRequest, NextResponse } from 'next/server'

// Serves admin-uploaded files stored on local disk under public/uploads.
// Needed for Docker/standalone: Next only serves public/ files that existed
// at build time. On Vercel uploads go to Blob (absolute URLs) — this route
// is never hit. Keep this file free of `fs` / `process.cwd()` so Turbopack
// does not NFT-trace the whole project ("Encountered unexpected file in NFT
// list"). Disk serving lives in ./serve-local and is loaded only off-Vercel.

export const dynamic = 'force-dynamic'

export async function GET(_request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  if (process.env.VERCEL) return new NextResponse('Not found', { status: 404 })
  const { serveLocalUpload } = await import(/* turbopackIgnore: true */ './serve-local')
  const { path } = await context.params
  return serveLocalUpload(path)
}
