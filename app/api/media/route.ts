import type { NextRequest } from 'next/server'
import { proxyImageResponse } from '@/lib/api/proxy-image'

/**
 * Same-origin image proxy for Prom.ua photos used in JSON-LD, Open Graph
 * and the Google Merchant feed. Emails keep using /api/email-image.
 *
 * SSRF: hostname is taken from a server-controlled allow-list of literals;
 * the raw `src` query never reaches fetch.
 */
export async function GET(req: NextRequest) {
  return proxyImageResponse(req, 'media-image', 2400)
}
