import { put, del } from '@vercel/blob'
import { type NextRequest, NextResponse } from 'next/server'
import { writeFile, unlink, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'
import { getAdminUser } from '@/lib/session'
import { hasPermission } from '@/lib/permissions'

const MAX_BYTES = 8 * 1024 * 1024 // 8 MB
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']
// Product photos never need more than this on any screen/zoom.
const MAX_DIMENSION = 1600
const WEBP_QUALITY = 82

// Self-hosted (Docker) deployments don't have a Vercel Blob store configured,
// so uploads fall back to local disk under public/uploads — served directly
// by Next's static file handler and persisted via the docker-compose volume
// mounted at that path. Vercel deployments keep using Blob automatically
// once BLOB_READ_WRITE_TOKEN is set in the project's environment variables.
const USE_BLOB = Boolean(process.env.BLOB_READ_WRITE_TOKEN)
// On Vercel the function filesystem is read-only and ephemeral, so the local
// fallback can never work there — Blob is the only real storage option.
const ON_VERCEL = Boolean(process.env.VERCEL)
const LOCAL_UPLOAD_DIR = join(process.cwd(), 'public', 'uploads', 'products')
const LOCAL_URL_PREFIX = '/uploads/products/'

// sharp is a native module; importing it at module scope crashed the whole
// route on Vercel (every request — even unauthenticated ones — returned a
// bare 500 before any handler code ran). Load it lazily and treat it as an
// optional optimization instead: if it can't be loaded, store the original
// image untouched rather than failing the upload.
async function loadSharp(): Promise<(typeof import('sharp'))['default'] | null> {
  try {
    return (await import('sharp')).default
  } catch (error) {
    console.error('[upload] sharp unavailable, storing original image:', error)
    return null
  }
}

function safeFileName(originalName: string, contentType: string): string {
  const ext = contentType === 'image/webp' ? 'webp' : contentType === 'image/gif' ? 'gif' : originalName.match(/\.[a-zA-Z0-9]+$/)?.[0] || '.jpg'
  return `${Date.now()}-${randomBytes(6).toString('hex')}${ext.startsWith('.') ? ext : `.${ext}`}`
}

async function storeLocally(body: Buffer, contentType: string, originalName: string): Promise<string> {
  await mkdir(LOCAL_UPLOAD_DIR, { recursive: true })
  const fileName = safeFileName(originalName, contentType)
  await writeFile(join(LOCAL_UPLOAD_DIR, fileName), body)
  return `${LOCAL_URL_PREFIX}${fileName}`
}

// Upload a product/variant image or a settings asset (logo/favicon) to the
// public Blob store. Used by both the product editor and the settings page,
// so allow either permission rather than hard-coding one.
export async function POST(request: NextRequest) {
  const admin = await getAdminUser()
  if (!admin || !(hasPermission(admin.permissions, 'products') || hasPermission(admin.permissions, 'settings'))) {
    return NextResponse.json({ error: 'Доступ запрещён' }, { status: 403 })
  }

  try {
    const formData = await request.formData()
    const file = formData.get('file')

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'Файл не передан' }, { status: 400 })
    }
    if (!ALLOWED.includes(file.type)) {
      return NextResponse.json(
        { error: 'Недопустимый формат. Разрешены JPG, PNG, WEBP, GIF, AVIF' },
        { status: 400 },
      )
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'Файл больше 8 МБ' }, { status: 400 })
    }

    // Fail early with an actionable message instead of throwing on a
    // read-only filesystem write further down.
    if (ON_VERCEL && !USE_BLOB) {
      return NextResponse.json(
        {
          error:
            'Хранилище изображений не настроено. Подключите Vercel Blob к проекту ' +
            '(Vercel → Storage → Create → Blob), чтобы переменная BLOB_READ_WRITE_TOKEN ' +
            'появилась в окружении, и передеплойте.',
        },
        { status: 503 },
      )
    }

    // Compress to WebP before storing: strips metadata, caps dimensions and
    // typically shrinks a phone photo 5-10x. Animated GIFs are kept as-is so
    // the animation survives.
    let body: Buffer = Buffer.from(await file.arrayBuffer())
    let fileName = file.name
    let contentType = file.type
    if (file.type !== 'image/gif') {
      const sharp = await loadSharp()
      if (sharp) {
        try {
          const original = body
          const compressed = await sharp(original)
            .rotate() // apply EXIF orientation before stripping metadata
            .resize(MAX_DIMENSION, MAX_DIMENSION, { fit: 'inside', withoutEnlargement: true })
            .webp({ quality: WEBP_QUALITY })
            .toBuffer()
          // Fall back to the original when WebP somehow ends up bigger (rare, tiny files).
          if (compressed.length < original.length) {
            body = compressed
            fileName = file.name.replace(/\.[^.]+$/, '') + '.webp'
            contentType = 'image/webp'
          }
        } catch (error) {
          // Corrupt/unsupported image data for sharp — keep the original bytes.
          console.error('[upload] compression failed, storing original image:', error)
        }
      }
    }

    if (USE_BLOB) {
      const blob = await put(`products/${fileName}`, body, {
        access: 'public',
        addRandomSuffix: true,
        contentType,
      })
      return NextResponse.json({ url: blob.url })
    }

    const url = await storeLocally(body, contentType, fileName)
    return NextResponse.json({ url })
  } catch (error) {
    console.error('[v0] upload error:', error)
    return NextResponse.json({ error: 'Не удалось загрузить файл' }, { status: 500 })
  }
}

// Remove an image from storage (admin only).
export async function DELETE(request: NextRequest) {
  const admin = await getAdminUser()
  if (!admin || !(hasPermission(admin.permissions, 'products') || hasPermission(admin.permissions, 'settings'))) {
    return NextResponse.json({ error: 'Доступ запрещён' }, { status: 403 })
  }

  try {
    const { url } = (await request.json()) as { url?: string }
    if (!url) {
      return NextResponse.json({ error: 'URL не передан' }, { status: 400 })
    }
    // Only delete blobs we actually own; ignore external/local URLs.
    if (url.includes('.public.blob.vercel-storage.com')) {
      await del(url)
    } else if (url.startsWith(LOCAL_URL_PREFIX)) {
      // Guard against path traversal: only allow a bare filename, no slashes/"..".
      const fileName = url.slice(LOCAL_URL_PREFIX.length)
      if (fileName && !fileName.includes('/') && !fileName.includes('..')) {
        await unlink(join(LOCAL_UPLOAD_DIR, fileName)).catch(() => {})
      }
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[v0] delete error:', error)
    return NextResponse.json({ error: 'Не удалось удалить файл' }, { status: 500 })
  }
}
