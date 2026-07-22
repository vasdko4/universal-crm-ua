'use server'

import { headers } from 'next/headers'
import { db } from '@/lib/db'
import { deliveryMethods } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { isRateLimited } from '@/lib/api/rate-limit'

const NP_URL = 'https://api.novaposhta.ua/v2.0/json/'

// SECURITY: these are public server actions that proxy to the Nova Poshta API
// with the store's key. Rate-limit per IP so a script cannot burn the API
// quota (NP throttles/blocks keys that flood requests).
async function isNpSearchRateLimited(): Promise<boolean> {
  const h = await headers()
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'unknown'
  return isRateLimited('np-search', ip, 30)
}

async function getApiKey(): Promise<string | null> {
  const [row] = await db
    .select()
    .from(deliveryMethods)
    .where(eq(deliveryMethods.code, 'nova_poshta'))
    .limit(1)
  const config = (row?.config as Record<string, unknown>) ?? {}
  return (config.apiKey as string) || process.env.NOVA_POSHTA_API_KEY || null
}

async function npRequest(modelName: string, calledMethod: string, methodProperties: Record<string, unknown>) {
  const apiKey = await getApiKey()
  if (!apiKey) return { success: false, error: 'Нова Пошта не настроена', data: [] }
  try {
    const res = await fetch(NP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey, modelName, calledMethod, methodProperties }),
      cache: 'no-store',
    })
    const json = await res.json()
    return { success: json.success as boolean, data: json.data ?? [], error: (json.errors ?? []).join(', ') }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Ошибка запроса', data: [] }
  }
}

export type NpCity = { ref: string; name: string; area: string; deliveryCityRef: string }

export async function searchCities(query: string): Promise<NpCity[]> {
  if (!query || query.trim().length < 2) return []
  if (await isNpSearchRateLimited()) return []
  const res = await npRequest('Address', 'searchSettlements', {
    CityName: query.trim(),
    Limit: 15,
    Page: 1,
  })
  if (!res.success) return []
  const addresses = res.data?.[0]?.Addresses ?? []
  return addresses.map((a: Record<string, unknown>) => ({
    ref: a.Ref as string,
    name: a.Present as string,
    area: (a.Area as string) ?? '',
    deliveryCityRef: (a.DeliveryCity as string) ?? '',
  }))
}

export type NpWarehouse = { ref: string; name: string; number: string }

export async function searchWarehouses(cityRef: string, query = ''): Promise<NpWarehouse[]> {
  if (!cityRef) return []
  if (await isNpSearchRateLimited()) return []
  const props: Record<string, unknown> = { CityRef: cityRef, Limit: 50, Page: 1 }
  if (query.trim()) props.FindByString = query.trim()
  const res = await npRequest('AddressGeneral', 'getWarehouses', props)
  if (!res.success) return []
  return (res.data ?? []).map((w: Record<string, unknown>) => ({
    ref: w.Ref as string,
    name: w.Description as string,
    number: (w.Number as string) ?? '',
  }))
}
