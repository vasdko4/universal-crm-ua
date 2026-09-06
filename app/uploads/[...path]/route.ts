import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { join, normalize, sep } from 'node:path'
import { Readable } from 'node:stream'
import { type NextRequest, NextResponse } from 'next/server'

// Serves admin-uploaded files (product photos, hero image, logo, favicon)
// stored on local disk under public/uploads.
//
// Why this route exists: with `output: 'standalone'` (our Docker/self-hosted
// deployments) Next.js only serves the public/ files that existed at BUILD
// time — anything written there at runtime by /api/admin/upload returns 404.
// In `next dev` the static handler happens to pick new files up, which is why
// the bug only shows up in production. Static files that did exist at build
// time are still served by the static layer first (it has priority over app
// routes), so this handler only receives the runtime-added ones.
//
// On Vercel uploads go to Blob storage (absolute URLs), so this route is
// simply never hit there. The GET handler returns 404 before touching disk.
//
// NFT: never call process.cwd() here. Turbopack treats that as "the whole
// project" and warns "Encountered unexpected file in NFT list" (and used to
// fail the Vercel packager). Docker WORKDIR is /app; override with UPLOADS_DIR.

export const dynamic = 'force-dynamic'

const MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  avif: 'image/avif',
  svg: 'image/svg+xml',
  ico: 'image/x-icon',
}

const UPLOADS_ROOT = process.env.UPLOADS_DIR || '/app/public/uploads'

function resolveSafe(parts: string[]): string | null {
  if (parts.some((p) => !p || p === '.' || p === '..' || p.includes('\\') || p.includes('\0'))) {
    return null
  }
  const filePath = normalize(join(UPLOADS_ROOT, ...parts))
  if (filePath !== UPLOADS_ROOT && !filePath.startsWith(UPLOADS_ROOT + sep)) return null
  return filePath
}

export async function GET(_request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  if (process.env.VERCEL) return new NextResponse('Not found', { status: 404 })

  const { path } = await context.params
  const filePath = resolveSafe(path ?? [])
  if (!filePath) return new NextResponse('Not found', { status: 404 })

  let info
  try {
    info = await stat(filePath)
  } catch {
    return new NextResponse('Not found', { status: 404 })
  }
  if (!info.isFile()) return new NextResponse('Not found', { status: 404 })

  const ext = filePath.split('.').pop()?.toLowerCase() ?? ''
  const contentType = MIME[ext] ?? 'application/octet-stream'

  const stream = Readable.toWeb(createReadStream(filePath)) as ReadableStream
  return new NextResponse(stream, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(info.size),
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
