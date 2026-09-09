export type NpSenderRefs = {
  senderCityRef: string
  senderRef: string
  senderAddressRef: string
  contactSenderRef: string
  senderPhone: string
  senderName?: string
  senderAddress?: string
}

function str(v: unknown): string {
  if (typeof v === 'string') return v.trim()
  if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  return ''
}

function asRows(data: unknown): Record<string, unknown>[] {
  if (!data) return []
  if (Array.isArray(data)) {
    return data.flatMap((row) => {
      if (!row || typeof row !== 'object') return []
      const obj = row as Record<string, unknown>
      // Some NP payloads nest lists: { Addresses: [...] } / { data: [...] }
      for (const key of ['Addresses', 'ContactPersons', 'data']) {
        if (Array.isArray(obj[key])) return asRows(obj[key])
      }
      return [obj]
    })
  }
  if (typeof data === 'object') return [data as Record<string, unknown>]
  return []
}

function cityRefOf(row: Record<string, unknown> | null): string {
  if (!row) return ''
  return (
    str(row.CityRef) ||
    str(row.CitySender) ||
    str(row.SettlementRef) ||
    str(row.City) ||
    str(row.DeliveryCity)
  )
}

function pickAddress(rows: Record<string, unknown>[]): Record<string, unknown> | null {
  if (rows.length === 0) return null
  const withCity = rows.find((r) => cityRefOf(r))
  if (withCity) return withCity
  const warehouse = rows.find((r) => /відділен|warehouse|відділ/i.test(str(r.Description) || str(r.AddressName)))
  return warehouse ?? rows[0]
}

function pickContact(rows: Record<string, unknown>[]): Record<string, unknown> | null {
  return rows.find((r) => str(r.Ref)) ?? rows[0] ?? null
}

function phoneOf(row: Record<string, unknown> | null): string {
  if (!row) return ''
  const phones = row.Phones
  if (Array.isArray(phones)) return str(phones[0])
  return str(row.Phones) || str(row.Phone) || str(row.Telephone)
}

/** Picks the first Sender counterparty + first usable warehouse address + first contact. */
export function parseSenderProfile(input: {
  counterparties: unknown
  addresses: unknown
  contacts: unknown
}): NpSenderRefs | null {
  const counterparties = asRows(input.counterparties)
  const addresses = asRows(input.addresses)
  const contacts = asRows(input.contacts)
  const cp = counterparties.find((r) => str(r.Ref)) ?? counterparties[0] ?? null
  const addr = pickAddress(addresses)
  const contact = pickContact(contacts)
  if (!cp || !addr || !contact) return null

  const senderRef = str(cp.Ref)
  const senderCityRef = cityRefOf(addr) || cityRefOf(cp)
  const senderAddressRef = str(addr.Ref)
  const contactSenderRef = str(contact.Ref)
  const senderPhone = phoneOf(contact) || phoneOf(cp)
  if (!senderRef || !senderCityRef || !senderAddressRef || !contactSenderRef) return null

  const first = str(contact.FirstName)
  const last = str(contact.LastName)
  const middle = str(contact.MiddleName)
  const senderName = [last, first, middle].filter(Boolean).join(' ') || str(cp.Description)

  return {
    senderCityRef,
    senderRef,
    senderAddressRef,
    contactSenderRef,
    senderPhone,
    senderName: senderName || undefined,
    senderAddress: str(addr.Description) || str(addr.AddressName) || undefined,
  }
}

export function cityNameFromAddress(addresses: unknown): string {
  const addr = pickAddress(asRows(addresses))
  if (!addr) return ''
  return str(addr.CityDescription) || str(addr.City) || str(addr.SettlementDescription)
}
