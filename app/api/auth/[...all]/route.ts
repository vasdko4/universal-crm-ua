import { getAuth } from '@/lib/auth'

// The Better Auth instance is created lazily so Google OAuth credentials can
// be read from the database (configured in the admin center).
export async function GET(req: Request) {
  const auth = await getAuth()
  return auth.handler(req)
}

export async function POST(req: Request) {
  const auth = await getAuth()
  return auth.handler(req)
}
