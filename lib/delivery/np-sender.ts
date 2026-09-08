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
  return typeof v === 'string' ? v.trim() : ''
}

function firstRow(data: unknown): Record<string, unknown> | null {
  if (Array.isArray(data) && data[0] && typeof data[0] === 'object') {
    return data[0] as Record<string, unknown>
  }
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    return data as Record<string, unknown>
  }
  return null
}

/** Picks the first Sender counterparty + first warehouse address + first contact. */
export function parseSenderProfile(input: {
  counterparties: unknown
  addresses: unknown
  contacts: unknown
}): NpSenderRefs | null {
  const cp = firstRow(input.counterparties)
  const addr = firstRow(input.addresses)
  const contact = firstRow(input.contacts)
  if (!cp || !addr || !contact) return null

  const senderRef = str(cp.Ref)
  const senderCityRef = str(addr.CityRef) || str(cp.City) || str(cp.CitySender)
  const senderAddressRef = str(addr.Ref)
  const contactSenderRef = str(contact.Ref)
  const senderPhone = str(contact.Phones) || str(contact.Phone) || str(cp.Phone)
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
