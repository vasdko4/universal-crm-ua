export type TtnSender = {
  cityRef: string
  senderRef: string
  senderAddressRef: string
  contactSenderRef: string
  phone: string
}

export type TtnRecipient = {
  name: string
  phone: string
  cityName: string
  cityRef?: string
  warehouseRef?: string
  warehouseName?: string
  address?: string
}

export type TtnCargo = {
  description: string
  cost: number
  weightKg: number
  seats: number
}

export type InternetDocumentProperties = Record<string, string>

export function digitsPhone(phone: string): string {
  const d = phone.replace(/\D/g, '')
  if (d.startsWith('380') && d.length >= 12) return d.slice(0, 12)
  if (d.startsWith('0') && d.length >= 10) return `380${d.slice(1, 10)}`
  if (d.length === 9) return `380${d}`
  return d
}

/**
 * The declared value Nova Poshta actually stores for a waybill: the cost
 * rounded to whole hryvnias, at least 1. The TTN reconciliation must
 * compare against this value — not the raw order total, whose kopecks NP
 * never sees (e.g. 1500.50 is stored as 1501). Shared by the payload
 * builder and the reconcile block so the two can never drift apart.
 */
export function declaredCost(cost: number): number {
  return Math.max(1, Math.round(cost))
}

function todayUa(): string {
  const now = new Date()
  const kyiv = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Kyiv' }))
  const dd = String(kyiv.getDate()).padStart(2, '0')
  const mm = String(kyiv.getMonth() + 1).padStart(2, '0')
  const yyyy = kyiv.getFullYear()
  return `${dd}.${mm}.${yyyy}`
}

/**
 * Builds InternetDocument.save methodProperties for a warehouse-to-warehouse
 * parcel. Pure so the payload can be unit-tested without hitting NP.
 */
export function buildInternetDocumentPayload(input: {
  sender: TtnSender
  recipient: TtnRecipient
  cargo: TtnCargo
  payerType?: 'Sender' | 'Recipient'
}): InternetDocumentProperties {
  const phone = digitsPhone(input.recipient.phone)
  const senderPhone = digitsPhone(input.sender.phone)
  const cost = declaredCost(input.cargo.cost)
  const weight = Math.max(0.1, Number(input.cargo.weightKg.toFixed(2)))
  const seats = Math.max(1, Math.floor(input.cargo.seats))
  const serviceType = input.recipient.warehouseRef || input.recipient.warehouseName ? 'WarehouseWarehouse' : 'WarehouseDoors'

  const props: InternetDocumentProperties = {
    PayerType: input.payerType ?? 'Sender',
    PaymentMethod: 'Cash',
    DateTime: todayUa(),
    CargoType: 'Parcel',
    Weight: String(weight),
    ServiceType: serviceType,
    SeatsAmount: String(seats),
    Description: (input.cargo.description || 'Товари').slice(0, 100),
    Cost: String(cost),
    CitySender: input.sender.cityRef,
    Sender: input.sender.senderRef,
    SenderAddress: input.sender.senderAddressRef,
    ContactSender: input.sender.contactSenderRef,
    SendersPhone: senderPhone,
    RecipientsPhone: phone,
    RecipientName: input.recipient.name.slice(0, 100),
    RecipientType: 'PrivatePerson',
  }

  if (input.recipient.warehouseRef) {
    if (input.recipient.cityRef) props.CityRecipient = input.recipient.cityRef
    props.RecipientAddress = input.recipient.warehouseRef
  } else {
    props.NewAddress = '1'
    props.RecipientCityName = input.recipient.cityName
    props.RecipientAddressName = (input.recipient.warehouseName || input.recipient.address || '').slice(0, 120)
    props.RecipientHouse = ''
    props.RecipientFlat = ''
  }

  return props
}

/** Sum product weights × qty; fall back to default when none of the lines have weight. */
export function parcelWeightKg(
  lines: { weightKg?: number | string | null; quantity: number }[],
  fallbackKg: number,
): number {
  let sum = 0
  let any = false
  let missing = 0
  for (const line of lines) {
    const w = Number(line.weightKg)
    const q = Math.max(1, Math.floor(Number(line.quantity)) || 1)
    if (Number.isFinite(w) && w > 0) {
      sum += w * q
      any = true
    } else {
      missing += q
    }
  }
  const fallback = Number.isFinite(fallbackKg) && fallbackKg > 0 ? fallbackKg : 0.5
  // No weights at all (including no lines) → the parcel weighs the default.
  if (!any) return Math.max(0.1, Number(fallback.toFixed(2)))
  // Partial weights used to understate the parcel: the unweighed lines were
  // silently dropped. Add the default once for the unknown portion instead.
  return Math.max(0.1, Number((sum + (missing > 0 ? fallback : 0)).toFixed(2)))
}

export function parseTtnFromSaveResponse(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null
  const row = Array.isArray(data) ? data[0] : data
  if (!row || typeof row !== 'object') return null
  const rec = row as Record<string, unknown>
  const ttn = rec.IntDocNumber ?? rec.IntDocNumberString ?? rec.Ref
  return typeof ttn === 'string' && ttn.trim() ? ttn.trim() : null
}

export function novaPoshtaPrintUrl(apiKey: string, ttn: string): string {
  const key = encodeURIComponent(apiKey)
  const doc = encodeURIComponent(ttn)
  return `https://my.novaposhta.ua/orders/printDocument/orders[]/${doc}/type/pdf/apiKey/${key}`
}

export function novaPoshtaTrackingUrl(ttn: string): string {
  return `https://novaposhta.ua/tracking/?cargo_number=${encodeURIComponent(ttn)}`
}
