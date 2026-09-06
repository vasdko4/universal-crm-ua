import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { join, normalize, sep } from 'node:path'
import { Readable } from 'node:stream'
import { NextResponse } from 'next/server'

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

// Docker WORKDIR is /app. Override with UPLOADS_DIR if the volume is mounted elsewhere.
const UPLOADS_ROOT = process.env.UPLOADS_DIR || '/app/public/uploads'

function resolveSafe(parts: string[]): string | null {
  if (parts.some((p) => !p || p === '.' || p === '..' || p.includes('\\') || p.includes('\0'))) {
    return null
  }
  const filePath = normalize(join(UPLOADS_ROOT, ...parts))
  if (filePath !== UPLOADS_ROOT && !filePath.startsWith(UPLOADS_ROOT + sep)) return null
  return filePath
}

export async function serveLocalUpload(path: string[] | undefined) {
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
