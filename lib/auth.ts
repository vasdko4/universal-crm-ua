import { betterAuth } from 'better-auth'
import { emailOTP } from 'better-auth/plugins'
import { createAuthMiddleware, APIError } from 'better-auth/api'
import { pool } from '@/lib/db'
import { sendMail } from '@/lib/mailer'
import { isAllowedEmailDomain, EMAIL_DOMAIN_ERROR } from '@/lib/shop/email-domains'

// Google OAuth credentials are configured in the admin center (Настройки →
// Вход через Google) and stored in the store_settings table. Env vars remain
// as a fallback for deployments configured through Vercel.
type GoogleCreds = { clientId: string; clientSecret: string }

async function readGoogleCreds(): Promise<GoogleCreds> {
  try {
    const { rows } = await pool.query<{ google_auth: Record<string, unknown> | null }>(
      'SELECT google_auth FROM store_settings WHERE id = 1',
    )
    const g = (rows[0]?.google_auth ?? {}) as {
      enabled?: boolean
      clientId?: string
      clientSecret?: string
    }
    if (g.enabled && g.clientId?.trim() && g.clientSecret?.trim()) {
      return { clientId: g.clientId.trim(), clientSecret: g.clientSecret.trim() }
    }
  } catch {
    // Table/column may not exist yet (fresh install) — fall through to env.
  }
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    return {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }
  }
  return { clientId: '', clientSecret: '' }
}

function buildAuth(google: GoogleCreds) {
  return betterAuth({
    database: pool,
    // Required in production. Better Auth only falls back to an auto-generated
    // dev secret locally; on Vercel this MUST be set or session calls throw (500).
    secret: process.env.BETTER_AUTH_SECRET,
    plugins: [
      emailOTP({
        otpLength: 6,
        // 15 minutes, as requested for password recovery codes.
        expiresIn: 15 * 60,
        allowedAttempts: 5,
        async sendVerificationOTP({ email, otp, type }) {
          if (type !== 'forget-password') return
          const subject = 'Код восстановления пароля'
          const text = `Ваш код для восстановления пароля: ${otp}\n\nКод действует 15 минут. Если вы не запрашивали восстановление — просто проигнорируйте это письмо.`
          const html = `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto">
          <h2 style="color:#111">Восстановление пароля</h2>
          <p>Используйте этот код, чтобы задать новый пароль. Он действует <b>15 минут</b>.</p>
          <div style="font-size:32px;font-weight:700;letter-spacing:8px;background:#f4f4f5;border-radius:12px;padding:16px;text-align:center;margin:16px 0">${otp}</div>
          <p style="color:#71717a;font-size:13px">Если вы не запрашивали восстановление пароля, проигнорируйте это письмо.</p>
        </div>`
          await sendMail({ to: email, subject, text, html }).catch((e) =>
            console.log('[v0] OTP email error:', (e as Error).message),
          )
        },
      }),
    ],
    baseURL:
      process.env.BETTER_AUTH_URL ??
      (process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
        : process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : process.env.V0_RUNTIME_URL),
    emailAndPassword: {
      enabled: true,
      autoSignIn: true,
      minPasswordLength: 8,
    },
    // Google OAuth (enabled only when credentials are configured in the admin
    // center or via env vars). New Google sign-ups always become storefront
    // customers, never staff.
    ...(google.clientId && google.clientSecret
      ? {
          socialProviders: {
            google: {
              clientId: google.clientId,
              clientSecret: google.clientSecret,
              mapProfileToUser: () => ({ role: 'customer' }),
            },
          },
        }
      : {}),
    // If a Google account uses the same email as an existing account, sign the
    // user into that existing account instead of creating a duplicate.
    account: {
      accountLinking: {
        enabled: true,
        trustedProviders: ['google'],
      },
    },
    // Storefront sign-up policy: only well-known mail providers are accepted,
    // which blocks disposable/temporary mailboxes. Internal server-side calls
    // (admin user creation from the admin center) have no HTTP request attached
    // and are exempt from this rule.
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path === '/sign-up/email' && ctx.request) {
          const email = String((ctx.body as { email?: string })?.email ?? '')
          if (!isAllowedEmailDomain(email)) {
            throw new APIError('BAD_REQUEST', { message: EMAIL_DOMAIN_ERROR })
          }
        }
      }),
    },
    // Brute-force protection: per-IP rate limiting on auth endpoints.
    // Sign-in/sign-up/OTP get a stricter budget than the rest of the API.
    // Sign-in: максимум 5 попыток, затем блокировка на 2 минуты (окно
    // сбрасывается через 120 секунд) — защита от перебора пароля.
    rateLimit: {
      enabled: true,
      window: 60,
      max: 60,
      customRules: {
        '/sign-in/email': { window: 120, max: 5 },
        '/sign-up/email': { window: 60, max: 5 },
        '/email-otp/send-verification-otp': { window: 300, max: 3 },
        '/email-otp/verify-otp': { window: 300, max: 5 },
      },
    },
    user: {
      additionalFields: {
        role: { type: 'string', required: false, defaultValue: 'manager', input: false },
        is_active: { type: 'boolean', required: false, defaultValue: true, input: false },
        phone: { type: 'string', required: false, input: true },
        // Admin-center interface language (uk/ru), tied to the admin account and
        // stored in the DB so it never needs to be re-asked on every login. Kept
        // out of the sign-up form (input: false) — changed only from the admin
        // sidebar language switcher via app/actions/admin-locale.ts.
        locale: { type: 'string', required: false, defaultValue: 'ru', input: false },
      },
    },
    trustedOrigins: [
      'http://localhost:3000',
      'https://*.vusercontent.net',
      'https://*.vercel.app',
      'https://*.v0.dev',
      // Self-hosted deployments: trust the configured public URL(s). APP_URL
      // covers setups where the public domain differs from BETTER_AUTH_URL
      // (e.g. a TLS-terminating proxy/domain in front of the VPS).
      ...(process.env.BETTER_AUTH_URL ? [process.env.BETTER_AUTH_URL] : []),
      ...(process.env.APP_URL ? [process.env.APP_URL] : []),
      ...(process.env.V0_RUNTIME_URL ? [process.env.V0_RUNTIME_URL] : []),
      ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []),
      ...(process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? [`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`]
        : []),
    ],
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
    },
    // Audit trail: record every successful sign-in (new session) with IP.
    databaseHooks: {
      user: {
        create: {
          // Safety net: ANY account created through a real, public HTTP
          // request — plain email/password sign-up or an OAuth callback —
          // must be a storefront customer, never the default 'manager' role.
          //
          // This used to only apply to OAuth-ish paths (checked via
          // ctx.path.includes('callback'/'social'/'oauth')). But the plain
          // /sign-up/email flow relies entirely on a *client-side, best-effort,
          // post-creation* call (finalizeCustomerRole) to downgrade the role
          // afterwards — nothing enforced this atomically at creation time.
          // Since additionalFields.role defaults to 'manager', and the seeded
          // 'manager' role has real permissions (orders/products/customers/
          // reviews), anyone could call POST /api/auth/sign-up/email directly
          // (bypassing the storefront's RegisterForm JS entirely, e.g. via
          // curl) and simply never call finalizeCustomerRole — landing with a
          // live session carrying full manager-level admin-panel access.
          //
          // ctx.request is only set for requests that went through the real
          // HTTP handler (app/api/auth/[...all]/route.ts) — i.e. any public
          // sign-up, email or social. Internal server-initiated account
          // creation (admin center calling auth.api.signUpEmail() directly
          // to create a staff member, see app/actions/users.ts) has no
          // ctx.request and is correctly exempt from this rule.
          before: async (user, ctx) => {
            if (ctx?.request) {
              return { data: { ...user, role: 'customer' } }
            }
            return { data: user }
          },
        },
      },
      session: {
        create: {
          async after(session) {
            try {
              const u = await pool.query('SELECT name, email, role FROM "user" WHERE id = $1', [
                session.userId,
              ])
              const row = u.rows[0]
              // Only staff logins go to the admin audit log, not shoppers.
              if (row && row.role !== 'customer') {
                await pool.query(
                  `INSERT INTO admin_logs (user_id, user_name, user_email, action, entity, details, ip)
                 VALUES ($1, $2, $3, 'login', 'auth', 'Вход в систему', $4)`,
                  [session.userId, row.name, row.email, session.ipAddress ?? null],
                )
              }
            } catch (e) {
              console.log('[v0] login audit failed:', (e as Error).message)
            }
          },
        },
      },
    },
    // Cross-site secure cookies are ONLY needed for the v0 HTTPS preview, which
    // runs the app inside an iframe on another origin. On a local machine over
    // http://localhost these attributes would make the browser drop the session
    // cookie (secure cookies require HTTPS), so we only enable them in preview.
    ...(process.env.V0_RUNTIME_URL
      ? {
          advanced: {
            defaultCookieAttributes: {
              sameSite: 'none' as const,
              secure: true,
            },
          },
        }
      : {}),
  })
}

export type Auth = ReturnType<typeof buildAuth>

// The instance is cached per credentials so we don't rebuild Better Auth on
// every request. Re-checked at most once per minute (multi-instance safety);
// invalidateAuthCache() applies changes immediately in the current instance.
const CACHE_TTL_MS = 60_000
let cached: { auth: Auth; key: string; at: number } | null = null

export async function getAuth(): Promise<Auth> {
  const now = Date.now()
  if (cached && now - cached.at < CACHE_TTL_MS) return cached.auth
  const creds = await readGoogleCreds()
  const key = `${creds.clientId}:${creds.clientSecret}`
  if (cached && cached.key === key) {
    cached.at = now
    return cached.auth
  }
  cached = { auth: buildAuth(creds), key, at: now }
  return cached.auth
}

// Called after settings are saved in the admin center so new Google keys
// apply without waiting for the TTL or a server restart.
export function invalidateAuthCache() {
  cached = null
}
