import QRCode from 'qrcode'

// Best-effort extraction of a real fiscal receipt URL from a gateway's raw
// API response. WayForPay and Monobank acquiring accounts that have
// fiscalization (PRRO) enabled on the bank's side include a check/receipt
// link in their status/webhook payload; merchants without that switched on
// simply won't have this field, and callers must fall back to a non-fiscal
// receipt in that case (see buildOrderReceipt).
//
// Field names are looked up defensively across a few known/likely keys since
// we cannot verify the exact shape without live fiscalization-enabled
// credentials from each provider — this only ever adds a link when the
// gateway actually supplies one, never fabricates one.
const RECEIPT_URL_KEYS = [
  'receiptUrl',
  'receipt_url',
  'checkUrl',
  'check_url',
  'fiscalCheckUrl',
  'fiscalUrl',
  'qrCodeUrl',
  'qrcodeUrl',
  'receiptLink',
]

export function extractGatewayReceiptUrl(gatewayCode: string, raw: unknown): string | null {
  if (gatewayCode !== 'wayforpay' && gatewayCode !== 'monobank') return null
  if (!raw || typeof raw !== 'object') return null

  const found = findUrlByKeys(raw as Record<string, unknown>, RECEIPT_URL_KEYS, 0)
  return found
}

// Shallow-then-one-level-deep search: gateways sometimes nest the receipt
// under a "receipt"/"checkbox" sub-object rather than at the top level.
function findUrlByKeys(obj: Record<string, unknown>, keys: string[], depth: number): string | null {
  for (const key of keys) {
    const value = obj[key]
    if (typeof value === 'string' && /^https?:\/\//.test(value)) return value
  }
  if (depth >= 1) return null
  for (const value of Object.values(obj)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const nested = findUrlByKeys(value as Record<string, unknown>, keys, depth + 1)
      if (nested) return nested
    }
  }
  return null
}

// PNG data URL for the receipt QR code — small enough to inline directly into
// the page/print output with no extra request or file storage.
export async function generateReceiptQrDataUrl(targetUrl: string): Promise<string> {
  return QRCode.toDataURL(targetUrl, { margin: 1, width: 240 })
}
