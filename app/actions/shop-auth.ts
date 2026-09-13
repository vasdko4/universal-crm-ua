'use server'

import { randomInt } from 'crypto'
import { pool } from '@/lib/db'
import { getShopUser } from '@/lib/session'
import { sendMail } from '@/lib/mailer'
import { normalizeUaPhone } from '@/lib/shop/phone'
import { isRateLimited } from '@/lib/api/rate-limit'
import { hashPassword } from 'better-auth/crypto'
import { getLocale } from '@/lib/i18n/server'

// The phone number is the stable customer identifier: it must be unique
// across accounts. Comparison uses the last 9 digits (operator + subscriber),
// which is format-independent ('+380 67...', '067...', '380...').
async function phoneTakenByOther(normPhone: string, exceptUserId?: string) {
  const digits = normPhone.replace(/\D/g, '')
  const { rows } = await pool.query(
    `SELECT 1 FROM "user"
     WHERE phone IS NOT NULL AND phone <> ''
       AND right(regexp_replace(phone, '[^0-9]', '', 'g'), 9) = right($1, 9)
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
         AND right(regexp_replace(customer_phone, '[^0-9]', '', 'g'), 9) = right($2, 9)`,
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

  // SECURITY: each request emails a code to an arbitrary address — without a
  // limit a logged-in account could be scripted into an email-bombing tool.
  if (isRateLimited('email-change-req', user.id, 3, 900_000)) {
    return { success: false, error: 'Слишком много запросов. Попробуйте через 15 минут.' }
  }

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

  // SECURITY: the code is 6 digits with a 15-minute TTL — cap verification
  // attempts so it cannot be brute-forced (10 tries per 15 minutes).
  if (isRateLimited('email-change-confirm', user.id, 10, 900_000)) {
    return { success: false, error: 'Слишком много попыток. Запросите новый код.' }
  }

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


async function hasCredentialPassword(userId: string): Promise<boolean> {
  const { rows } = await pool.query(
    `SELECT 1 FROM account WHERE "userId"=$1 AND "providerId"='credential' AND password IS NOT NULL AND password <> '' LIMIT 1`,
    [userId],
  )
  return rows.length > 0
}

/** Google-only accounts cannot change email or password. Credential accounts can. */
export async function getProfileSecurity() {
  const user = await getShopUser()
  if (!user) return { google: false, canChangeEmail: false, canChangePassword: false }
  const google = await isGoogleLinked(user.id)
  const credential = await hasCredentialPassword(user.id)
  return {
    google,
    canChangeEmail: !google,
    canChangePassword: credential && !google,
  }
}

const PASSWORD_CODE_TTL_MINUTES = 15

export async function requestPasswordChange() {
  const user = await getShopUser()
  if (!user) return { success: false as const, error: 'Не авторизован' }

  if (isRateLimited('password-change-req', user.id, 3, 900_000)) {
    return { success: false as const, error: 'Забагато запитів. Спробуйте через 15 хвилин.' }
  }

  if (await isGoogleLinked(user.id)) {
    return { success: false as const, error: 'Вхід через Google — змінити пароль не можна' }
  }
  if (!(await hasCredentialPassword(user.id))) {
    return { success: false as const, error: 'У цього акаунта немає пароля' }
  }

  const email = user.email?.trim().toLowerCase()
  if (!email) return { success: false as const, error: 'Немає email для надсилання коду' }

  const code = String(randomInt(100000, 1000000))
  const identifier = `password-change:${user.id}`
  await pool.query(`DELETE FROM verification WHERE identifier=$1`, [identifier])
  await pool.query(
    `INSERT INTO verification (id, identifier, value, "expiresAt", "createdAt", "updatedAt")
     VALUES (gen_random_uuid()::text, $1, $2, NOW() + ($3 || ' minutes')::interval, NOW(), NOW())`,
    [identifier, JSON.stringify({ code }), PASSWORD_CODE_TTL_MINUTES],
  )

  const locale = await getLocale().catch(() => 'uk' as const)
  const uk = locale !== 'ru'
  await sendMail({
    to: email,
    subject: uk ? 'Код для зміни пароля' : 'Код для смены пароля',
    text: uk
      ? `Ваш код для зміни пароля: ${code}\n\nКод діє ${PASSWORD_CODE_TTL_MINUTES} хвилин. Якщо ви не запитували зміну — проігноруйте цей лист.`
      : `Ваш код для смены пароля: ${code}\n\nКод действует ${PASSWORD_CODE_TTL_MINUTES} минут. Если вы не запрашивали смену — проигнорируйте это письмо.`,
  })

  return { success: true as const }
}

export async function confirmPasswordChange(codeRaw: string, newPasswordRaw: string) {
  const user = await getShopUser()
  if (!user) return { success: false as const, error: 'Не авторизован' }

  if (isRateLimited('password-change-confirm', user.id, 10, 900_000)) {
    return { success: false as const, error: 'Забагато спроб. Запросіть новий код.' }
  }

  if (await isGoogleLinked(user.id)) {
    return { success: false as const, error: 'Вхід через Google — змінити пароль не можна' }
  }

  const code = codeRaw.trim()
  if (!/^\d{6}$/.test(code)) return { success: false as const, error: 'Код має складатися з 6 цифр' }
  const password = newPasswordRaw
  if (password.length < 8) return { success: false as const, error: 'Пароль має бути не коротшим за 8 символів' }

  const identifier = `password-change:${user.id}`
  const res = await pool.query(
    `SELECT value FROM verification WHERE identifier=$1 AND "expiresAt" > NOW() LIMIT 1`,
    [identifier],
  )
  if (res.rows.length === 0) {
    return { success: false as const, error: 'Код сплив або не запитувався. Запросіть новий.' }
  }
  let payload: { code?: string } = {}
  try {
    payload = JSON.parse(res.rows[0].value)
  } catch {
    return { success: false as const, error: 'Помилка даних. Запросіть новий код.' }
  }
  if (payload.code !== code) return { success: false as const, error: 'Невірний код' }

  const hashed = await hashPassword(password)
  const updated = await pool.query(
    `UPDATE account SET password=$1, "updatedAt"=NOW()
     WHERE "userId"=$2 AND "providerId"='credential'`,
    [hashed, user.id],
  )
  if ((updated.rowCount ?? 0) === 0) {
    return { success: false as const, error: 'У цього акаунта немає пароля' }
  }
  await pool.query(`DELETE FROM verification WHERE identifier=$1`, [identifier])
  return { success: true as const }
}
