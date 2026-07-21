'use server'

import { db } from '@/lib/db'
import { customers, customerContacts } from '@/lib/db/schema'
import { and, asc, desc, eq, ilike, inArray, isNull, or, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { assertPermission } from '@/lib/session'

export type ContactInput = {
  type: string
  value: string
}

export type CustomerInput = {
  firstName: string
  lastName?: string | null
  phone: string
  email?: string | null
  reliabilityScore?: number
  note?: string | null
  contacts?: ContactInput[]
}

export type CustomerListItem = {
  id: number
  firstName: string
  lastName: string | null
  phone: string
  email: string | null
  reliabilityScore: number
  ordersCount: number
  totalTurnover: string
  lastOrderDate: Date | null
  tags: string[]
  note: string | null
  contacts: { id: number; type: string; value: string }[]
}

const PAGE_SIZE = 10

export async function getCustomers(opts?: { search?: string; page?: number; minScore?: number }) {
  await assertPermission('customers')
  const page = Math.max(1, opts?.page ?? 1)
  const search = opts?.search?.trim()
  const minScore = opts?.minScore

  const conditions = [isNull(customers.deletedAt)]
  if (search) {
    conditions.push(
      or(
        ilike(customers.firstName, `%${search}%`),
        ilike(customers.lastName, `%${search}%`),
        ilike(customers.phone, `%${search}%`),
        ilike(customers.email, `%${search}%`),
      )!,
    )
  }
  if (typeof minScore === 'number' && minScore > 0) {
    conditions.push(sql`${customers.reliabilityScore} >= ${minScore}`)
  }
  const where = and(...conditions)

  const [rows, totalRes] = await Promise.all([
    db
      .select()
      .from(customers)
      .where(where)
      .orderBy(desc(customers.lastOrderDate), desc(customers.id))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ count: sql<number>`count(*)::int` }).from(customers).where(where),
  ])

  const total = totalRes[0]?.count ?? 0
  const ids = rows.map((r) => r.id)

  const contactRows = ids.length
    ? await db
        .select()
        .from(customerContacts)
        .where(inArray(customerContacts.customerId, ids))
        .orderBy(asc(customerContacts.sortOrder), asc(customerContacts.id))
    : []

  const contactsMap = new Map<number, { id: number; type: string; value: string }[]>()
  for (const c of contactRows) {
    const list = contactsMap.get(c.customerId) ?? []
    list.push({ id: c.id, type: c.type, value: c.value })
    contactsMap.set(c.customerId, list)
  }

  const items: CustomerListItem[] = rows.map((r) => ({
    id: r.id,
    firstName: r.firstName,
    lastName: r.lastName,
    phone: r.phone,
    email: r.email,
    reliabilityScore: r.reliabilityScore,
    ordersCount: r.ordersCount,
    totalTurnover: r.totalTurnover,
    lastOrderDate: r.lastOrderDate,
    tags: (r.tags as string[]) ?? [],
    note: r.note,
    contacts: contactsMap.get(r.id) ?? [],
  }))

  return {
    items,
    total,
    page,
    pageSize: PAGE_SIZE,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  }
}

function validate(input: CustomerInput): string | null {
  if (!input.firstName?.trim()) return 'Имя обязательно'
  if (!input.phone?.trim()) return 'Основной телефон обязателен'
  if (input.email && input.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) {
    return 'Некорректный email'
  }
  return null
}

function cleanContacts(contacts?: ContactInput[]) {
  return (contacts ?? [])
    .filter((c) => c.type?.trim() && c.value?.trim())
    .map((c, i) => ({ type: c.type.trim(), value: c.value.trim(), sortOrder: i }))
}

export async function createCustomer(input: CustomerInput) {
  await assertPermission('customers')
  const error = validate(input)
  if (error) return { success: false, error }

  const [row] = await db
    .insert(customers)
    .values({
      firstName: input.firstName.trim(),
      lastName: input.lastName?.trim() || null,
      phone: input.phone.trim(),
      email: input.email?.trim() || null,
      reliabilityScore: input.reliabilityScore ?? 100,
      note: input.note?.trim() || null,
    })
    .returning({ id: customers.id })

  const contacts = cleanContacts(input.contacts)
  if (contacts.length) {
    await db.insert(customerContacts).values(
      contacts.map((c) => ({ ...c, customerId: row.id })),
    )
  }

  revalidatePath('/admin/customers')
  return { success: true, id: row.id }
}

export async function updateCustomer(id: number, input: CustomerInput) {
  await assertPermission('customers')
  const error = validate(input)
  if (error) return { success: false, error }

  await db
    .update(customers)
    .set({
      firstName: input.firstName.trim(),
      lastName: input.lastName?.trim() || null,
      phone: input.phone.trim(),
      email: input.email?.trim() || null,
      reliabilityScore: input.reliabilityScore ?? 100,
      note: input.note?.trim() || null,
      updatedAt: new Date(),
    })
    .where(eq(customers.id, id))

  // Пересобираем дополнительные контакты
  await db.delete(customerContacts).where(eq(customerContacts.customerId, id))
  const contacts = cleanContacts(input.contacts)
  if (contacts.length) {
    await db.insert(customerContacts).values(
      contacts.map((c) => ({ ...c, customerId: id })),
    )
  }

  revalidatePath('/admin/customers')
  return { success: true }
}

export async function deleteCustomer(id: number) {
  await assertPermission('customers')
  // Мягкое удаление
  await db
    .update(customers)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(customers.id, id))
  revalidatePath('/admin/customers')
  return { success: true }
}

export async function addCustomerTag(id: number, tag: string) {
  await assertPermission('customers')
  const clean = tag.trim()
  if (!clean) return { success: false, error: 'Пустой тег' }

  const [row] = await db
    .select({ tags: customers.tags })
    .from(customers)
    .where(eq(customers.id, id))
  if (!row) return { success: false, error: 'Клиент не найден' }

  const current = (row.tags as string[]) ?? []
  if (current.includes(clean)) return { success: true }

  await db
    .update(customers)
    .set({ tags: [...current, clean], updatedAt: new Date() })
    .where(eq(customers.id, id))
  revalidatePath('/admin/customers')
  return { success: true }
}

export async function removeCustomerTag(id: number, tag: string) {
  await assertPermission('customers')
  const [row] = await db
    .select({ tags: customers.tags })
    .from(customers)
    .where(eq(customers.id, id))
  if (!row) return { success: false, error: 'Клиент не найден' }

  const current = (row.tags as string[]) ?? []
  await db
    .update(customers)
    .set({ tags: current.filter((t) => t !== tag), updatedAt: new Date() })
    .where(eq(customers.id, id))
  revalidatePath('/admin/customers')
  return { success: true }
}
