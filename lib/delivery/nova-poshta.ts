const NP_ENDPOINT = 'https://api.novaposhta.ua/v2.0/json/'

// Справочные Ref'ы типов отделений Нова Пошта
const POSTOMAT_REF = 'f9316480-5f2d-425d-bc2c-ac7cd29decf0'

export type NpWarehouse = {
  ref: string
  number: string
  description: string
  shortAddress: string
  city: string
  type: 'branch' | 'postomat'
  maxWeight?: string
}

export type NpCity = {
  ref: string
  name: string
  area: string
}

export type NpTrackingResult = {
  ttn: string
  status: string
  statusCode: string
  delivered: boolean
  returned: boolean
}

type NpResponse<T> = {
  success: boolean
  data: T[]
  errors: string[]
  warnings: string[]
}

async function npRequest<T>(
  apiKey: string,
  modelName: string,
  calledMethod: string,
  methodProperties: Record<string, unknown>,
): Promise<NpResponse<T>> {
  const res = await fetch(NP_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey, modelName, calledMethod, methodProperties }),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Nova Poshta API вернул статус ${res.status}`)
  return (await res.json()) as NpResponse<T>
}

/* --------------------------- Демо-данные (без ключа) --------------------------- */

const DEMO_CITIES: NpCity[] = [
  { ref: 'db5c88d0-391c-11dd-90d9-001a92567626', name: 'Київ', area: 'Київська' },
  { ref: 'db5c88f0-391c-11dd-90d9-001a92567626', name: 'Харків', area: 'Харківська' },
  { ref: 'db5c890f-391c-11dd-90d9-001a92567626', name: 'Львів', area: 'Львівська' },
  { ref: 'db5c896a-391c-11dd-90d9-001a92567626', name: 'Одеса', area: 'Одеська' },
  { ref: 'db5c8970-391c-11dd-90d9-001a92567626', name: 'Дніпро', area: 'Дніпропетровська' },
]

function demoWarehouses(city: string, query: string, type: 'branch' | 'postomat'): NpWarehouse[] {
  const base: NpWarehouse[] = []
  const count = type === 'postomat' ? 6 : 12
  for (let i = 1; i <= count; i++) {
    const num = String(i)
    base.push({
      ref: `demo-${type}-${city}-${i}`,
      number: num,
      description:
        type === 'postomat'
          ? `Поштомат №${num}`
          : `Відділення №${num}`,
      shortAddress: `${city}, вул. Прикладна, ${i * 3}`,
      city,
      type,
      maxWeight: type === 'postomat' ? '30' : '1100',
    })
  }
  const q = query.trim().toLowerCase()
  if (!q) return base
  return base.filter(
    (w) =>
      w.number.includes(q) ||
      w.description.toLowerCase().includes(q) ||
      w.shortAddress.toLowerCase().includes(q),
  )
}

/* ------------------------------- Публичные методы ------------------------------- */

// Коды статусов Нова Пошта: 9/10/11 — получена, 102-108 — возврат/отказ.
const DELIVERED_CODES = new Set(['9', '10', '11'])
const RETURNED_CODES = new Set(['102', '103', '104', '105', '106', '108'])

/**
 * Запрашивает статусы накладных (ТТН) через TrackingDocument/getStatusDocuments.
 * Nova Poshta принимает до 100 документов за один запрос — батчим автоматически.
 */
export async function trackDocuments(
  apiKey: string,
  ttns: string[],
): Promise<NpTrackingResult[]> {
  const unique = [...new Set(ttns.map((t) => t.trim()).filter(Boolean))]
  if (unique.length === 0) return []

  const results: NpTrackingResult[] = []
  for (let i = 0; i < unique.length; i += 100) {
    const batch = unique.slice(i, i + 100)
    const resp = await npRequest<{
      Number: string
      Status: string
      StatusCode: string
    }>(apiKey, 'TrackingDocument', 'getStatusDocuments', {
      Documents: batch.map((ttn) => ({ DocumentNumber: ttn, Phone: '' })),
    })
    if (!resp.success) {
      throw new Error(resp.errors.join(', ') || 'Ошибка запроса статусов ТТН')
    }
    for (const d of resp.data) {
      if (!d.Number || !d.Status) continue
      const code = String(d.StatusCode ?? '')
      results.push({
        ttn: d.Number,
        status: d.Status,
        statusCode: code,
        delivered: DELIVERED_CODES.has(code),
        returned: RETURNED_CODES.has(code),
      })
    }
  }
  return results
}

export async function searchCities(apiKey: string, query: string): Promise<NpCity[]> {
  const q = query.trim()
  if (!apiKey) {
    const lower = q.toLowerCase()
    return DEMO_CITIES.filter((c) => !lower || c.name.toLowerCase().includes(lower))
  }
  const resp = await npRequest<{ Ref: string; Description: string; AreaDescription: string }>(
    apiKey,
    'Address',
    'getCities',
    { FindByString: q, Limit: '20' },
  )
  if (!resp.success) throw new Error(resp.errors.join(', ') || 'Ошибка поиска городов')
  return resp.data.map((c) => ({ ref: c.Ref, name: c.Description, area: c.AreaDescription }))
}

export async function searchWarehouses(
  apiKey: string,
  params: { cityName: string; cityRef?: string; query: string; type: 'branch' | 'postomat' },
): Promise<{ demo: boolean; items: NpWarehouse[] }> {
  const { cityName, cityRef, query, type } = params
  if (!apiKey) {
    return { demo: true, items: demoWarehouses(cityName || 'Київ', query, type) }
  }
  const methodProperties: Record<string, unknown> = {
    FindByString: query.trim(),
    Limit: '30',
  }
  if (cityRef) methodProperties.CityRef = cityRef
  else if (cityName) methodProperties.CityName = cityName
  if (type === 'postomat') methodProperties.TypeOfWarehouseRef = POSTOMAT_REF

  const resp = await npRequest<{
    Ref: string
    Number: string
    Description: string
    ShortAddress: string
    CityDescription: string
    CategoryOfWarehouse: string
    PlaceMaxWeightAllowed: string
  }>(apiKey, 'Address', 'getWarehouses', methodProperties)

  if (!resp.success) throw new Error(resp.errors.join(', ') || 'Ошибка поиска отделений')

  const items = resp.data
    .filter((w) =>
      type === 'postomat'
        ? w.CategoryOfWarehouse === 'Postomat'
        : w.CategoryOfWarehouse !== 'Postomat',
    )
    .map<NpWarehouse>((w) => ({
      ref: w.Ref,
      number: w.Number,
      description: w.Description,
      shortAddress: w.ShortAddress || w.Description,
      city: w.CityDescription,
      type,
      maxWeight: w.PlaceMaxWeightAllowed,
    }))
  return { demo: false, items }
}
