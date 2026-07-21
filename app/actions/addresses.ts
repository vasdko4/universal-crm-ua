'use server'

import { revalidatePath } from 'next/cache'
import { pool } from '@/lib/db'
import { getShopUser } from '@/lib/session'

export type UserAddress = {
  id: number
  label: string | null
  firstName: string
  lastName: string | null
  phone: string
  deliveryMethod: string
  city: string | null
  cityRef: string | null
  branch: string | null
  branchType: string | null
  postIndex: string | null
  isDefault: boolean
}

export type AddressInput = {
  id?: number
  label?: string | null
  firstName: string
  lastName?: string | null
  phone: string
  deliveryMethod?: string
  city?: string | null
  cityRef?: string | null
  branch?: string | null
  branchType?: string | null
  postIndex?: string | null
  isDefault?: boolean
}

function mapRow(r: Record<string, unknown>): UserAddress {
  return {
    id: Number(r.id),
    label: (r.label as string) ?? null,
    firstName: (r.first_name as string) ?? '',
    lastName: (r.last_name as string) ?? null,
    phone: (r.phone as string) ?? '',
    deliveryMethod: (r.delivery_method as string) ?? 'nova_poshta',
    city: (r.city as string) ?? null,
    cityRef: (r.city_ref as string) ?? null,
    branch: (r.branch as string) ?? null,
    branchType: (r.branch_type as string) ?? null,
    postIndex: (r.post_index as string) ?? null,
    isDefault: Boolean(r.is_default),
  }
}

// List the current user's saved addresses (default first, then newest).
export async function getUserAddresses(): Promise<UserAddress[]> {
  const user = await getShopUser()
  if (!user) return []
  const { rows } = await pool.query(
    `SELECT * FROM "user_addresses" WHERE user_id = $1 ORDER BY is_default DESC, created_at DESC`,
    [user.id],
  )
  return rows.map(mapRow)
}

// Create or update an address. All writes are scoped to the session user id.
export async function saveUserAddress(
  input: AddressInput,
): Promise<{ ok: boolean; error?: string; id?: number }> {
  const user = await getShopUser()
  if (!user) return { ok: false, error: 'unauthorized' }

  if (!input.firstName?.trim() || !input.phone?.trim()) {
    return { ok: false, error: 'invalid' }
  }

  const method = input.deliveryMethod || 'nova_poshta'
  const makeDefault = input.isDefault ?? false

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // Only one default address per user.
    if (makeDefault) {
      await client.query(
        `UPDATE "user_addresses" SET is_default = false WHERE user_id = $1`,
        [user.id],
      )
    }

    let id = input.id
    if (id) {
      // Ensure the row belongs to this user before updating.
      const check = await client.query(
        `SELECT id FROM "user_addresses" WHERE id = $1 AND user_id = $2`,
        [id, user.id],
      )
      if (check.rowCount === 0) {
        await client.query('ROLLBACK')
        return { ok: false, error: 'not_found' }
      }
      await client.query(
        `UPDATE "user_addresses"
         SET label = $1, first_name = $2, last_name = $3, phone = $4, delivery_method = $5,
             city = $6, city_ref = $7, branch = $8, branch_type = $9, post_index = $10,
             is_default = $11, updated_at = now()
         WHERE id = $12 AND user_id = $13`,
        [
          input.label ?? null,
          input.firstName.trim(),
          input.lastName ?? null,
          input.phone.trim(),
          method,
          input.city ?? null,
          input.cityRef ?? null,
          input.branch ?? null,
          input.branchType ?? null,
          input.postIndex ?? null,
          makeDefault,
          id,
          user.id,
        ],
      )
    } else {
      // First address for a user becomes the default automatically.
      const countRes = await client.query(
        `SELECT COUNT(*)::int AS c FROM "user_addresses" WHERE user_id = $1`,
        [user.id],
      )
      const isFirst = (countRes.rows[0]?.c ?? 0) === 0
      const insert = await client.query(
        `INSERT INTO "user_addresses"
          (user_id, label, first_name, last_name, phone, delivery_method, city, city_ref, branch, branch_type, post_index, is_default)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         RETURNING id`,
        [
          user.id,
          input.label ?? null,
          input.firstName.trim(),
          input.lastName ?? null,
          input.phone.trim(),
          method,
          input.city ?? null,
          input.cityRef ?? null,
          input.branch ?? null,
          input.branchType ?? null,
          input.postIndex ?? null,
          makeDefault || isFirst,
        ],
      )
      id = Number(insert.rows[0].id)
    }

    await client.query('COMMIT')
    revalidatePath('/account/addresses')
    return { ok: true, id }
  } catch (e) {
    await client.query('ROLLBACK')
    console.error('[v0] saveUserAddress error:', e)
    return { ok: false, error: 'server' }
  } finally {
    client.release()
  }
}

export async function deleteUserAddress(id: number): Promise<{ ok: boolean }> {
  const user = await getShopUser()
  if (!user) return { ok: false }
  await pool.query(`DELETE FROM "user_addresses" WHERE id = $1 AND user_id = $2`, [id, user.id])
  revalidatePath('/account/addresses')
  return { ok: true }
}

export async function setDefaultAddress(id: number): Promise<{ ok: boolean }> {
  const user = await getShopUser()
  if (!user) return { ok: false }
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(`UPDATE "user_addresses" SET is_default = false WHERE user_id = $1`, [
      user.id,
    ])
    await client.query(
      `UPDATE "user_addresses" SET is_default = true, updated_at = now() WHERE id = $1 AND user_id = $2`,
      [id, user.id],
    )
    await client.query('COMMIT')
    revalidatePath('/account/addresses')
    return { ok: true }
  } catch {
    await client.query('ROLLBACK')
    return { ok: false }
  } finally {
    client.release()
  }
}
