'use server'

import { randomInt } from 'crypto'
import { pool } from '@/lib/db'
import { getShopUser } from '@/lib/session'
import { sendMail } from '@/lib/mailer'
import { normalizeUaPhone } from '@/lib/shop/phone'

// The phone number is the stable customer identifier: it must be unique
// across accounts. Comparison uses the last 9 digits (operator + subscriber),
// which is format-independent ('+380 67...', '067...', '380...').
async function phoneTakenByOther(normPhone: string, exceptUserId?: string) {
  const digits = normPhone.replace(/\D/g, '')
  const { rows } = await pool.query(
    `SELECT 1 FROM "user"
     WHERE phone IS NOT NULL AND phone <> ''
       AND right(regexp_replace(phone, '\\D', '', 'g'), 9) = right($1, 9)
       AND ($2::text IS NULL OR id <> $2)
     LIMIT 1`,
    [digits, exceptUserId ?? null],
  )
  return rows.length > 0
}

// Attach past orders (e.g. guest checkouts) made with the same phone number
// to this account, so the order history is complete from day one.
async function claimOrdersByPhone(userId: string, normPhone: string) {
  const digits = normPhone.replace(/\D/g, '')
  await pool
    .query(
      `UPDATE orders SET user_id = $1
       WHERE user_id IS NULL
         AND customer_phone IS NOT NULL
         AND right(regexp_replace(customer_phone, '\\D', '', 'g'), 9) = right($2, 9)`,
      [userId, digits],
    )
    .catch(() => {})
}

// Pre-registration check used by the sign-up form BEFORE creating the account,
// so we never end up with an account that has a duplicate phone.
export async function checkPhoneAvailable(phone: string) {
  const norm = normalizeUaPhone(phone ?? '')
  if (!norm) return { available: false, error: 'Введите корректный номер телефона' }
  if (await phoneTakenByOther(norm)) {
    return { available: false, error: 'Этот номер телефона уже зарегистрирован. Войдите в существующий аккаунт.' }
  }
  return { available: true }
}

// After a client-side signUp, ensure the new account is a storefront customer
// and has the phone persisted. Called right after registration succeeds.
export async function finalizeCustomerRole(phone: string) {
  const user = await getShopUser()
  if (!user) return { success: false }
  // The customer role must be set unconditionally — never leave a storefront
  // sign-up with the default staff role, even if the phone step fails.
  await pool.query(`UPDATE "user" SET role='customer' WHERE id=$1`, [user.id])
  const norm = normalizeUaPhone(phone ?? '')
  if (!norm) return { success: false, error: 'Введите корректный номер телефона' }
  if (await phoneTakenByOther(norm, user.id)) {
    // Race lost: the number was claimed between the pre-check and now. The
    // PhoneGuard dialog will ask for a (different) number on next page load.
    return { success: false, error: 'Этот номер телефона уже зарегистрирован' }
  }
  await pool.query(`UPDATE "user" SET phone=$1, "updatedAt"=NOW() WHERE id=$2`, [norm, user.id])
  await claimOrdersByPhone(user.id, norm)
  return { success: true }
}

// After a Google sign-up the account has no phone yet. This sets it exactly
// once (only while the phone is still empty) — the phone stays immutable
// afterwards, same as with email registration. The phone must be unique.
export async function saveCustomerPhone(phone: string) {
  const user = await getShopUser()
  if (!user) return { success: false, error: 'Не авторизован' }
  const norm = normalizeUaPhone(phone ?? '')
  if (!norm) return { success: false, error: 'Введите корректный номер телефона (например, +380 67 123 45 67)' }
  if (await phoneTakenByOther(norm, user.id)) {
    return { success: false, error: 'Этот номер уже привязан к другому аккаунту' }
  }
  const res = await pool.query(
    `UPDATE "user" SET phone=$1, "updatedAt"=NOW() WHERE id=$2 AND (phone IS NULL OR phone='')`,
    [norm, user.id],
  )
  if (res.rowCount === 0) return { success: false, error: 'Телефон уже указан' }
  await claimOrdersByPhone(user.id, norm)
  return { success: true }
}

// The phone is intentionally NOT updatable here: it is set once at
// registration and used as a stable identifier for orders.
export async function updateCustomerProfile(input: { name: string }) {
  const user = await getShopUser()
  if (!user) return { success: false, error: 'Не авторизован' }
  const name = input.name?.trim()
  if (!name) return { success: false, error: 'Введите имя' }
  await pool.query(`UPDATE "user" SET name=$1, "updatedAt"=NOW() WHERE id=$2`, [name, user.id])
  return { success: true }
}

/* ------------------------- Email change with code ------------------------ */

// Google-authenticated accounts must keep the email that Google verified:
// it is the link between our user row and the Google identity. Changing it
// would break OAuth sign-in matching and allow identity spoofing.
async function isGoogleLinked(userId: string): Promise<boolean> {
  const { rows } = await pool.query(
    `SELECT 1 FROM account WHERE "userId"=$1 AND "providerId"='google' LIMIT 1`,
    [userId],
  )
  return rows.length > 0
}

// Exposed for the profile page to decide whether to render the change-email UI.
export async function getEmailChangeAvailability() {
  const user = await getShopUser()
  if (!user) return { allowed: false, reason: 'unauthorized' as const }
  if (await isGoogleLinked(user.id)) return { allowed: false, reason: 'google' as const }
  return { allowed: true as const }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const CODE_TTL_MINUTES = 15

// Step 1: user requests a change — we email a 6-digit code to the NEW address.
export async function requestEmailChange(newEmailRaw: string) {
  const user = await getShopUser()
  if (!user) return { success: false, error: 'Не авторизован' }

  if (await isGoogleLinked(user.id)) {
    return { success: false, error: 'Вход выполнен через Google — сменить email нельзя' }
  }

  const newEmail = newEmailRaw.trim().toLowerCase()
  if (!EMAIL_RE.test(newEmail)) return { success: false, error: 'Введите корректный email' }
  if (newEmail === user.email.toLowerCase()) {
    return { success: false, error: 'Это ваш текущий email' }
  }

  const taken = await pool.query(`SELECT 1 FROM "user" WHERE lower(email)=$1 LIMIT 1`, [newEmail])
  if (taken.rows.length > 0) return { success: false, error: 'Этот email уже занят' }

  const code = String(randomInt(100000, 1000000)) // 6 digits, crypto-secure
  const identifier = `email-change:${user.id}`

  // One active request per user: replace any previous one.
  await pool.query(`DELETE FROM verification WHERE identifier=$1`, [identifier])
  await pool.query(
    `INSERT INTO verification (id, identifier, value, "expiresAt", "createdAt", "updatedAt")
     VALUES (gen_random_uuid()::text, $1, $2, NOW() + ($3 || ' minutes')::interval, NOW(), NOW())`,
    [identifier, JSON.stringify({ email: newEmail, code }), CODE_TTL_MINUTES],
  )

  await sendMail({
    to: newEmail,
    subject: 'Код подтверждения смены email',
    text: `Ваш код подтверждения: ${code}\n\nКод действует ${CODE_TTL_MINUTES} минут. Если вы не запрашивали смену email, проигнорируйте это письмо.`,
  })

  return { success: true }
}

// Step 2: user submits the code — verify and swap the email.
export async function confirmEmailChange(codeRaw: string) {
  const user = await getShopUser()
  if (!user) return { success: false, error: 'Не авторизован' }

  if (await isGoogleLinked(user.id)) {
    return { success: false, error: 'Вход выполнен через Google — сменить email нельзя' }
  }

  const code = codeRaw.trim()
  if (!/^\d{6}$/.test(code)) return { success: false, error: 'Код должен состоять из 6 цифр' }

  const identifier = `email-change:${user.id}`
  const res = await pool.query(
    `SELECT value FROM verification WHERE identifier=$1 AND "expiresAt" > NOW() LIMIT 1`,
    [identifier],
  )
  if (res.rows.length === 0) {
    return { success: false, error: 'Код истёк или не запрашивался. Запросите новый.' }
  }

  let payload: { email?: string; code?: string } = {}
  try {
    payload = JSON.parse(res.rows[0].value)
  } catch {
    return { success: false, error: 'Ошибка данных. Запросите новый код.' }
  }
  if (payload.code !== code) return { success: false, error: 'Неверный код' }
  if (!payload.email) return { success: false, error: 'Ошибка данных. Запросите новый код.' }

  // Re-check uniqueness at confirm time to avoid races.
  const taken = await pool.query(
    `SELECT 1 FROM "user" WHERE lower(email)=$1 AND id<>$2 LIMIT 1`,
    [payload.email, user.id],
  )
  if (taken.rows.length > 0) return { success: false, error: 'Этот email уже занят' }

  // Login lookups go through "user".email; the credential account row keys on
  // userId, so updating the user row is sufficient.
  await pool.query(
    `UPDATE "user" SET email=$1, "emailVerified"=true, "updatedAt"=NOW() WHERE id=$2`,
    [payload.email, user.id],
  )
  await pool.query(`DELETE FROM verification WHERE identifier=$1`, [identifier])

  return { success: true, email: payload.email }
}
