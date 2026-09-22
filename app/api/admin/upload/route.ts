import { put, del } from '@vercel/blob'
import { type NextRequest, NextResponse } from 'next/server'
import { writeFile, unlink, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'
import { getAdminUser, staffTwoFactorSatisfied } from '@/lib/session'
import { canWrite } from '@/lib/permissions'
import { readJson } from '@/lib/api/helpers'
import { detectImageKind, extForImageKind, mimeForImageKind } from '@/lib/api/image-kind'

const MAX_BYTES = 8 * 1024 * 1024 // 8 MB
const MAX_DIMENSION = 1600
const WEBP_QUALITY = 82

const USE_BLOB = Boolean(process.env.BLOB_READ_WRITE_TOKEN)
const ON_VERCEL = Boolean(process.env.VERCEL)
const LOCAL_UPLOAD_DIR = join(process.cwd(), 'public', 'uploads', 'products')
const LOCAL_URL_PREFIX = '/uploads/products/'

async function loadSharp(): Promise<(typeof import('sharp'))['default'] | null> {
  try {
    return (await import('sharp')).default
  } catch (error) {
    console.error('[upload] sharp unavailable, storing original image:', error)
    return null
  }
}

function generatedFileName(ext: string): string {
  return `${Date.now()}-${randomBytes(6).toString('hex')}${ext}`
}

async function storeLocally(body: Buffer, ext: string): Promise<string> {
  await mkdir(LOCAL_UPLOAD_DIR, { recursive: true })
  const fileName = generatedFileName(ext)
  await writeFile(join(LOCAL_UPLOAD_DIR, fileName), body)
  return `${LOCAL_URL_PREFIX}${fileName}`
}

export async function POST(request: NextRequest) {
  const admin = await getAdminUser()
  if (
    !admin ||
    !(await staffTwoFactorSatisfied(admin.id)) ||
    !(canWrite(admin.permissions, 'products') || canWrite(admin.permissions, 'settings'))
  ) {
    return NextResponse.json({ error: 'Доступ запрещён' }, { status: 403 })
  }

  try {
    const formData = await request.formData()
    const file = formData.get('file')

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'Файл не передан' }, { status: 400 })
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'Файл больше 8 МБ' }, { status: 400 })
    }

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

    let body: Buffer = Buffer.from(await file.arrayBuffer())
    const kind = detectImageKind(body)
    if (!kind) {
      return NextResponse.json(
        { error: 'Недопустимый формат. Разрешены JPG, PNG, WEBP, GIF, AVIF' },
        { status: 400 },
      )
    }

    let ext = extForImageKind(kind)
    let contentType = mimeForImageKind(kind)

    // GIF stays as-is (animation). Everything else is re-encoded to WebP so
    // the stored bytes come from sharp, not the attacker-supplied payload.
    if (kind !== 'gif') {
      const sharp = await loadSharp()
      if (!sharp) {
        return NextResponse.json(
          { error: 'Не удалось проверить изображение. Попробуйте другой файл.' },
          { status: 422 },
        )
      }
      try {
        const compressed = await sharp(body)
          .rotate()
          .resize(MAX_DIMENSION, MAX_DIMENSION, { fit: 'inside', withoutEnlargement: true })
          .webp({ quality: WEBP_QUALITY })
          .toBuffer()
        body = compressed
        ext = '.webp'
        contentType = 'image/webp'
      } catch (error) {
        console.error('[upload] compression failed:', error)
        return NextResponse.json(
          { error: 'Файл не является корректным изображением' },
          { status: 400 },
        )
      }
    }

    const fileName = generatedFileName(ext)
    if (USE_BLOB) {
      const blob = await put(`products/${fileName}`, body, {
        access: 'public',
        addRandomSuffix: true,
        contentType,
        cacheControlMaxAge: 60 * 60 * 24 * 365,
      })
      return NextResponse.json({ url: blob.url })
    }

    const url = await storeLocally(body, ext)
    return NextResponse.json({ url })
  } catch (error) {
    console.error('[v0] upload error:', error)
    return NextResponse.json({ error: 'Не удалось загрузить файл' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const admin = await getAdminUser()
  if (
    !admin ||
    !(await staffTwoFactorSatisfied(admin.id)) ||
    !(canWrite(admin.permissions, 'products') || canWrite(admin.permissions, 'settings'))
  ) {
    return NextResponse.json({ error: 'Доступ запрещён' }, { status: 403 })
  }

  try {
    const body = await readJson<{ url?: string }>(request)
    if (!body) {
      return NextResponse.json({ error: 'Некорректный JSON' }, { status: 400 })
    }
    const url = body.url
    if (!url) {
      return NextResponse.json({ error: 'URL не передан' }, { status: 400 })
    }
    if (url.includes('.public.blob.vercel-storage.com')) {
      await del(url)
    } else if (url.startsWith(LOCAL_URL_PREFIX)) {
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
