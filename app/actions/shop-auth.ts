'use server'

import { randomInt } from 'crypto'
import { pool } from '@/lib/db'
import { getAuth } from '@/lib/auth'
import { getShopUser } from '@/lib/session'
import { sendMail } from '@/lib/mailer'
import { normalizeUaPhone } from '@/lib/shop/phone'
import { isRateLimited, clientIpFromHeaders } from '@/lib/api/rate-limit'
import { headers } from 'next/headers'
import { looksLikeEmail } from '@/lib/text'
import { hashPassword, verifyPassword } from 'better-auth/crypto'
import { getLocale } from '@/lib/i18n/server'
import { requiredReauthForEmailChange } from '@/lib/shop/email-change-reauth'
import {
  EMAIL_VERIFY_TTL_MINUTES,
  emailVerificationMail,
  isSixDigitCode,
} from '@/lib/shop/email-verification'
import { getStoreSettingsInternal } from '@/lib/store-settings'
import { hashVerificationCode } from '@/lib/shop/verification-codes'

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

async function isGoogleLinked(userId: string): Promise<boolean> {
  const { rows } = await pool.query(
    `SELECT 1 FROM account WHERE "userId"=$1 AND "providerId"='google' LIMIT 1`,
    [userId],
  )
  return rows.length > 0
}

// Pre-registration check used by the sign-up form BEFORE creating the account,
// so we never end up with an account that has a duplicate phone.
export async function checkPhoneAvailable(phone: string) {
  // BUGFIX: this unauthenticated action used to be a rate-limit-free oracle
  // for enumerating registered phone numbers (PII). Throttle per IP.
  const ip = clientIpFromHeaders(await headers())
  if (await isRateLimited('phone-available', ip, 10, 600_000)) {
    return { available: false, error: 'Забагато спроб. Спробуйте пізніше.' }
  }
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
  // Locale follows the storefront language the shopper registered in, not
  // the Better Auth additionalFields default.
  const locale = await getLocale().catch(() => 'uk' as const)
  await pool.query(`UPDATE "user" SET role='customer', locale=$2 WHERE id=$1`, [user.id, locale])
  const norm = normalizeUaPhone(phone ?? '')
  if (!norm) return { success: false, error: 'Введите корректный номер телефона' }
  if (await phoneTakenByOther(norm, user.id)) {
    // Race lost: the number was claimed between the pre-check and now. The
    // PhoneGuard dialog will ask for a (different) number on next page load.
    return { success: false, error: 'Этот номер телефона уже зарегистрирован' }
  }
  await pool.query(`UPDATE "user" SET phone=$1, "updatedAt"=NOW() WHERE id=$2`, [norm, user.id])
  return { success: true }
}

export async function sendEmailVerification() {
  const user = await getShopUser()
  if (!user) return { success: false as const, error: 'Не авторизован' }

  if (await isGoogleLinked(user.id)) {
    await pool.query(`UPDATE "user" SET "emailVerified"=true, "updatedAt"=NOW() WHERE id=$1 AND "emailVerified"=false`, [
      user.id,
    ])
    return { success: true as const, alreadyVerified: true as const }
  }

  const { rows } = await pool.query<{ emailVerified: boolean }>(
    `SELECT "emailVerified" FROM "user" WHERE id=$1 LIMIT 1`,
    [user.id],
  )
  if (rows[0]?.emailVerified) return { success: true as const, alreadyVerified: true as const }

  if (await isRateLimited('email-verify-req', user.id, 3, 900_000)) {
    return { success: false as const, error: 'Забагато запитів. Спробуйте через 15 хвилин.' }
  }

  const email = user.email?.trim().toLowerCase()
  if (!email) return { success: false as const, error: 'Немає email для надсилання коду' }

  const code = String(randomInt(100000, 1000000))
  const identifier = `email-verify:${user.id}`
  await pool.query(`DELETE FROM verification WHERE identifier=$1`, [identifier])
  await pool.query(
    `INSERT INTO verification (id, identifier, value, "expiresAt", "createdAt", "updatedAt")
     VALUES (gen_random_uuid()::text, $1, $2, NOW() + ($3 || ' minutes')::interval, NOW(), NOW())`,
    [identifier, JSON.stringify({ codeHash: hashVerificationCode(code) }), EMAIL_VERIFY_TTL_MINUTES],
  )

  const locale = await getLocale().catch(() => 'uk' as const)
  const settings = await getStoreSettingsInternal().catch(() => null)
  const mail = emailVerificationMail(locale === 'ru' ? 'ru' : 'uk', code, {
    storeName: settings?.storeName,
    siteUrl: settings?.seo?.siteUrl,
    logoUrl: settings?.logoUrl,
    supportEmail: (settings?.emailSettings?.fromEmail as string) || null,
  })
  const sent = await sendMail({ to: email, subject: mail.subject, text: mail.text, html: mail.html })
  if (!sent.sent) return { success: false as const, error: 'Не вдалося надіслати код. Спробуйте пізніше.' }
  return { success: true as const, alreadyVerified: false as const }
}

export async function confirmEmailVerification(codeRaw: string) {
  const user = await getShopUser()
  if (!user) return { success: false as const, error: 'Не авторизован' }

  if (await isRateLimited('email-verify-confirm', user.id, 10, 900_000)) {
    return { success: false as const, error: 'Забагато спроб. Запросіть новий код.' }
  }

  const { rows: verified } = await pool.query<{ emailVerified: boolean }>(
    `SELECT "emailVerified" FROM "user" WHERE id=$1 LIMIT 1`,
    [user.id],
  )
  if (verified[0]?.emailVerified) return { success: true as const }

  const code = codeRaw.trim()
  if (!isSixDigitCode(code)) return { success: false as const, error: 'Код має складатися з 6 цифр' }

  const identifier = `email-verify:${user.id}`
  // Atomic consume: the DELETE itself matches the code hash, so two
  // concurrent confirms cannot both pass — the loser finds no row.
  const consumed = await pool.query(
    `DELETE FROM verification
     WHERE identifier=$1 AND "expiresAt" > NOW()
       AND value::jsonb->>'codeHash' = $2`,
    [identifier, hashVerificationCode(code)],
  )
  if ((consumed.rowCount ?? 0) === 0) {
    return { success: false as const, error: 'Невірний код або код сплив. Запросіть новий.' }
  }

  await pool.query(`UPDATE "user" SET "emailVerified"=true, "updatedAt"=NOW() WHERE id=$1`, [user.id])
  return { success: true as const }
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


// Exposed for the profile page to decide whether to render the change-email UI.
export async function getEmailChangeAvailability() {
  const user = await getShopUser()
  if (!user) return { allowed: false, reason: 'unauthorized' as const }
  if (await isGoogleLinked(user.id)) return { allowed: false, reason: 'google' as const }
  return { allowed: true as const }
}

const CODE_TTL_MINUTES = 15

const OLD_EMAIL_CODE_TTL_MINUTES = 15

// Step 0 (passwordless accounts only): send a 6-digit code to the CURRENT
// email so the owner can prove the old address before the new-address code
// step. Password accounts never use this — they prove ownership with the
// current password instead (requestEmailChange enforces the branch).
export async function requestOldEmailChangeCode() {
  const user = await getShopUser()
  if (!user) return { success: false as const, error: 'Не авторизован' }

  if (await isRateLimited('email-change-old-req', user.id, 3, 900_000)) {
    return { success: false as const, error: 'Слишком много запросов. Попробуйте через 15 минут.' }
  }

  if (await isGoogleLinked(user.id)) {
    return { success: false as const, error: 'Вход выполнен через Google — сменить email нельзя' }
  }
  if (await hasCredentialPassword(user.id)) {
    return { success: false as const, error: 'Подтвердите смену текущим паролем' }
  }

  const email = user.email?.trim().toLowerCase()
  if (!email) return { success: false as const, error: 'Немає email для надсилання коду' }

  const code = String(randomInt(100000, 1000000))
  const identifier = `email-change-old:${user.id}`
  await pool.query(`DELETE FROM verification WHERE identifier=$1`, [identifier])
  await pool.query(
    `INSERT INTO verification (id, identifier, value, "expiresAt", "createdAt", "updatedAt")
     VALUES (gen_random_uuid()::text, $1, $2, NOW() + ($3 || ' minutes')::interval, NOW(), NOW())`,
    [identifier, JSON.stringify({ codeHash: hashVerificationCode(code) }), OLD_EMAIL_CODE_TTL_MINUTES],
  )

  const locale = await getLocale().catch(() => 'uk' as const)
  const uk = locale !== 'ru'
  const sent = await sendMail({
    to: email,
    subject: uk ? 'Код для підтвердження зміни email' : 'Код для подтверждения смены email',
    text: uk
      ? `Ваш код для підтвердження зміни email: ${code}\n\nКод діє ${OLD_EMAIL_CODE_TTL_MINUTES} хвилин. Якщо ви не запитували зміну — проігноруйте цей лист.`
      : `Ваш код для подтверждения смены email: ${code}\n\nКод действует ${OLD_EMAIL_CODE_TTL_MINUTES} минут. Если вы не запрашивали смену — проигнорируйте это письмо.`,
  })
  if (!sent.sent) return { success: false as const, error: 'Не вдалося надіслати код. Спробуйте пізніше.' }

  return { success: true as const }
}

// Step 1: user requests a change — we email a 6-digit code to the NEW address.
export async function requestEmailChange(
  newEmailRaw: string,
  reauth?: { currentPassword?: string; oldEmailCode?: string },
) {
  const user = await getShopUser()
  if (!user) return { success: false, error: 'Не авторизован' }

  // SECURITY: each request emails a code to an arbitrary address — without a
  // limit a logged-in account could be scripted into an email-bombing tool.
  if (await isRateLimited('email-change-req', user.id, 3, 900_000)) {
    return { success: false, error: 'Слишком много запросов. Попробуйте через 15 минут.' }
  }

  if (await isGoogleLinked(user.id)) {
    return { success: false, error: 'Вход выполнен через Google — сменить email нельзя' }
  }

  const newEmail = newEmailRaw.trim().toLowerCase()
  if (!looksLikeEmail(newEmail)) return { success: false, error: 'Введите корректный email' }
  if (newEmail === user.email.toLowerCase()) {
    return { success: false, error: 'Это ваш текущий email' }
  }

  const taken = await pool.query(`SELECT 1 FROM "user" WHERE lower(email)=$1 LIMIT 1`, [newEmail])
  if (taken.rows.length > 0) return { success: false, error: 'Этот email уже занят' }

  // SECURITY: a stolen session alone must not be enough to take over the
  // account. Before any code goes to the NEW address, the caller must prove
  // the current identity — with the current password, or (passwordless
  // accounts) with a code sent to the CURRENT address. The branch is
  // enforced here, never in the client: a password account cannot substitute
  // the old-email code, and a passwordless account cannot skip the step.
  const reauthKind = requiredReauthForEmailChange({
    google: false,
    hasPassword: await hasCredentialPassword(user.id),
  })
  if (reauthKind === 'password') {
    const currentPassword = reauth?.currentPassword ?? ''
    if (!currentPassword) return { success: false, error: 'Введіть поточний пароль' }
    const { rows } = await pool.query<{ password: string | null }>(
      `SELECT password FROM account WHERE "userId"=$1 AND "providerId"='credential' LIMIT 1`,
      [user.id],
    )
    const storedHash = rows[0]?.password ?? ''
    // Better Auth's own scrypt verify (same module as hashPassword above) —
    // no hand-rolled hash comparison. A missing hash fails closed.
    const ok = storedHash ? await verifyPassword({ hash: storedHash, password: currentPassword }) : false
    if (!ok) return { success: false, error: 'Невірний поточний пароль' }
  } else {
    const oldCode = (reauth?.oldEmailCode ?? '').trim()
    if (!/^\d{6}$/.test(oldCode)) {
      return { success: false, error: 'Введіть код з листа на поточну пошту' }
    }
    // Atomic consume: the DELETE itself matches the code hash, so the
    // old-address proof cannot be replayed for a second change.
    const consumed = await pool.query(
      `DELETE FROM verification
       WHERE identifier=$1 AND "expiresAt" > NOW()
         AND value::jsonb->>'codeHash' = $2`,
      [`email-change-old:${user.id}`, hashVerificationCode(oldCode)],
    )
    if ((consumed.rowCount ?? 0) === 0) {
      return { success: false, error: 'Невірний код або код сплив. Запросіть новий.' }
    }
  }

  const code = String(randomInt(100000, 1000000)) // 6 digits, crypto-secure
  const identifier = `email-change:${user.id}`

  // One active request per user: replace any previous one.
  await pool.query(`DELETE FROM verification WHERE identifier=$1`, [identifier])
  await pool.query(
    `INSERT INTO verification (id, identifier, value, "expiresAt", "createdAt", "updatedAt")
     VALUES (gen_random_uuid()::text, $1, $2, NOW() + ($3 || ' minutes')::interval, NOW(), NOW())`,
    [identifier, JSON.stringify({ email: newEmail, codeHash: hashVerificationCode(code) }), CODE_TTL_MINUTES],
  )

  const sent = await sendMail({
    to: newEmail,
    subject: 'Код подтверждения смены email',
    text: `Ваш код подтверждения: ${code}\n\nКод действует ${CODE_TTL_MINUTES} минут. Если вы не запрашивали смену email, проигнорируйте это письмо.`,
  })
  if (!sent.sent) return { success: false, error: 'Не вдалося надіслати код. Спробуйте пізніше.' }

  return { success: true }
}

// Step 2: user submits the code — verify and swap the email.
export async function confirmEmailChange(codeRaw: string) {
  const user = await getShopUser()
  if (!user) return { success: false, error: 'Не авторизован' }

  // SECURITY: the code is 6 digits with a 15-minute TTL — cap verification
  // attempts so it cannot be brute-forced (10 tries per 15 minutes).
  if (await isRateLimited('email-change-confirm', user.id, 10, 900_000)) {
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

  // The SELECT only reads the target email; the code itself is matched by
  // the atomic DELETE below, so a concurrent confirm cannot reuse it.
  let payload: { email?: string; codeHash?: string } = {}
  try {
    payload = JSON.parse(res.rows[0].value)
  } catch {
    return { success: false, error: 'Ошибка данных. Запросите новый код.' }
  }
  if (!payload.email) return { success: false, error: 'Ошибка данных. Запросите новый код.' }

  // Re-check uniqueness at confirm time to avoid races.
  const taken = await pool.query(
    `SELECT 1 FROM "user" WHERE lower(email)=$1 AND id<>$2 LIMIT 1`,
    [payload.email, user.id],
  )
  if (taken.rows.length > 0) return { success: false, error: 'Этот email уже занят' }

  // Atomic consume: the DELETE itself matches the code hash, so two
  // concurrent confirms cannot both pass — the loser finds no row.
  const consumed = await pool.query(
    `DELETE FROM verification
     WHERE identifier=$1 AND "expiresAt" > NOW()
       AND value::jsonb->>'codeHash' = $2`,
    [identifier, hashVerificationCode(code)],
  )
  if ((consumed.rowCount ?? 0) === 0) {
    return { success: false, error: 'Неверный код' }
  }

  // Login lookups go through "user".email; the credential account row keys on
  // userId, so updating the user row is sufficient.
  await pool.query(
    `UPDATE "user" SET email=$1, "emailVerified"=true, "updatedAt"=NOW() WHERE id=$2`,
    [payload.email, user.id],
  )

  // A stolen session on another device must not survive an email change —
  // same revocation as a password change; the current session stays.
  await revokeOtherSessions(user.id)

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

  if (await isRateLimited('password-change-req', user.id, 3, 900_000)) {
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
    [identifier, JSON.stringify({ codeHash: hashVerificationCode(code) }), PASSWORD_CODE_TTL_MINUTES],
  )

  const locale = await getLocale().catch(() => 'uk' as const)
  const uk = locale !== 'ru'
  const sent = await sendMail({
    to: email,
    subject: uk ? 'Код для зміни пароля' : 'Код для смены пароля',
    text: uk
      ? `Ваш код для зміни пароля: ${code}\n\nКод діє ${PASSWORD_CODE_TTL_MINUTES} хвилин. Якщо ви не запитували зміну — проігноруйте цей лист.`
      : `Ваш код для смены пароля: ${code}\n\nКод действует ${PASSWORD_CODE_TTL_MINUTES} минут. Если вы не запрашивали смену — проигнорируйте это письмо.`,
  })
  if (!sent.sent) return { success: false as const, error: 'Не вдалося надіслати код. Спробуйте пізніше.' }

  return { success: true as const }
}

/**
 * Revokes all of the user's sessions except the one making this request, so
 * a stolen session on another device does not survive a credential change.
 * If the current session cannot be identified, revokes all of them.
 * Shared by confirmPasswordChange and confirmEmailChange.
 */
async function revokeOtherSessions(userId: string): Promise<void> {
  const auth = await getAuth()
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
  const currentSessionId = (session as { session?: { id?: string } } | null)?.session?.id
  if (currentSessionId) {
    await pool.query(`DELETE FROM session WHERE "userId" = $1 AND id <> $2`, [userId, currentSessionId])
  } else {
    await pool.query(`DELETE FROM session WHERE "userId" = $1`, [userId])
  }
}

export async function confirmPasswordChange(codeRaw: string, newPasswordRaw: string) {
  const user = await getShopUser()
  if (!user) return { success: false as const, error: 'Не авторизован' }

  if (await isRateLimited('password-change-confirm', user.id, 10, 900_000)) {
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
  // Atomic consume: the DELETE itself matches the code hash, so two
  // concurrent confirms cannot both pass — the loser finds no row.
  const consumed = await pool.query(
    `DELETE FROM verification
     WHERE identifier=$1 AND "expiresAt" > NOW()
       AND value::jsonb->>'codeHash' = $2`,
    [identifier, hashVerificationCode(code)],
  )
  if ((consumed.rowCount ?? 0) === 0) {
    return { success: false as const, error: 'Невірний код або код сплив. Запросіть новий.' }
  }

  const hashed = await hashPassword(password)
  const updated = await pool.query(
    `UPDATE account SET password=$1, "updatedAt"=NOW()
     WHERE "userId"=$2 AND "providerId"='credential'`,
    [hashed, user.id],
  )
  if ((updated.rowCount ?? 0) === 0) {
    return { success: false as const, error: 'У цього акаунта немає пароля' }
  }
  // BUGFIX: a password change must revoke other sessions — otherwise a stolen
  // session stays valid. The current session stays: the user just proved
  // ownership with the code. If it cannot be identified, revoke all of them.
  await revokeOtherSessions(user.id)
  return { success: true as const }
}
