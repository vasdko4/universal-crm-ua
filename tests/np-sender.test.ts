import { describe, it, expect } from 'vitest'
import { parseSenderProfile } from '@/lib/delivery/np-sender'

describe('parseSenderProfile', () => {
  it('maps counterparties, warehouse address and contact into TTN sender refs', () => {
    const refs = parseSenderProfile({
      counterparties: [{ Ref: 'cp-1', Description: 'ФОП Іваненко', Phone: '380671112233' }],
      addresses: [{ Ref: 'wh-9', CityRef: 'city-kyiv', Description: 'Відділення №9' }],
      contacts: [{ Ref: 'ct-1', FirstName: 'Іван', LastName: 'Іваненко', Phones: '380671112233' }],
    })
    expect(refs).toEqual({
      senderCityRef: 'city-kyiv',
      senderRef: 'cp-1',
      senderAddressRef: 'wh-9',
      contactSenderRef: 'ct-1',
      senderPhone: '380671112233',
      senderName: 'Іваненко Іван',
      senderAddress: 'Відділення №9',
    })
  })

  it('returns null when any piece is missing', () => {
    expect(
      parseSenderProfile({
        counterparties: [{ Ref: 'cp-1' }],
        addresses: [],
        contacts: [{ Ref: 'ct-1' }],
      }),
    ).toBeNull()
  })

  it('falls back to counterparty CitySender when the address has no CityRef', () => {
    expect(
      parseSenderProfile({
        counterparties: [{ Ref: 'cp-1', CitySender: 'city-kyiv', Phone: '380671112233' }],
        addresses: [{ Ref: 'wh-9', Description: 'Відділення №9' }],
        contacts: [{ Ref: 'ct-1', FirstName: 'Іван', LastName: 'Іваненко' }],
      }),
    ).toMatchObject({
      senderCityRef: 'city-kyiv',
      senderRef: 'cp-1',
      senderAddressRef: 'wh-9',
      contactSenderRef: 'ct-1',
    })
  })
})
