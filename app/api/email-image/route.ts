import type { NextRequest } from 'next/server'
import { proxyImageResponse } from '@/lib/api/proxy-image'

/**
 * Image proxy for transactional emails.
 *
 * Product images live on external hosts (e.g. images.prom.ua) that reject
 * requests from email-client image proxies (Gmail/googleusercontent), so the
 * pictures show up broken in the inbox. This route fetches the image
 * server-side and serves it from our own domain, which email proxies accept.
 *
 * SSRF: hostname is taken from a server-controlled allow-list of literals;
 * each redirect hop is rebuilt through the same allow-list.
 */
export async function GET(req: NextRequest) {
  return proxyImageResponse(req, 'email-image', 60)
}
