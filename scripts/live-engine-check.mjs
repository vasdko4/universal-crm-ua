#!/usr/bin/env node
/** GitLab live-engine check. Hits the deployed shop and fails the job on regressions. */
const BASE = (process.env.LIVE_SHOP_URL || 'https://magazine-test-ten.vercel.app').replace(/\/$/, '')

const fail = []
const ok = []

async function fetchRes(path, opts = {}) {
  const url = path.startsWith('http') ? path : BASE + path
  const res = await fetch(url, { redirect: opts.redirect || 'manual', headers: { 'user-agent': 'gitlab-live-engine/1.0' } })
  const buf = Buffer.from(await res.arrayBuffer())
  const headers = Object.fromEntries([...res.headers.entries()].map(([k, v]) => [k.toLowerCase(), v]))
  return { url, status: res.status, headers, body: buf, text: buf.toString('utf8') }
}

function check(name, cond, detail) {
  if (cond) ok.push(name)
  else fail.push(detail ? `${name}: ${detail}` : name)
}

const r = await fetchRes('/api/health')
check('GET /api/health 200', r.status === 200, `got ${r.status} ${r.text.slice(0, 200)}`)

for (const path of ['/', '/catalog', '/checkout', '/cart']) {
  const res = await fetchRes(path)
  check(`GET ${path} 200`, res.status === 200, `got ${res.status}`)
  if (path === '/cart') {
    check('cart is not Next error overlay', !res.text.includes('id="__next_error__"'), 'html#__next_error__ present')
    check('cart has heading', /кошик|корзин/i.test(res.text), 'missing cart title')
  }
}

const home = await fetchRes('/')
const csp = home.headers['content-security-policy'] || ''
check('CSP nonce', /nonce-[A-Za-z0-9]+/.test(csp), csp.slice(0, 180))
check('CSP no unsafe-eval', !csp.includes('unsafe-eval'), csp.slice(0, 180))
check('X-Frame-Options DENY', (home.headers['x-frame-options'] || '').toLowerCase() === 'deny', home.headers['x-frame-options'])
check("CSP frame-ancestors none", /frame-ancestors\s+'none'/.test(csp), csp.slice(0, 180))
check('HSTS on HTTPS', /max-age=\d+/.test(home.headers['strict-transport-security'] || ''), home.headers['strict-transport-security'])
check('no Sentry in HTML', !/browser\.sentry|ingest\.sentry|cdn\.sentry/i.test(home.text), 'sentry string in homepage')
check('no X-Powered-By', !home.headers['x-powered-by'], home.headers['x-powered-by'])

const http = await fetchRes(BASE.replace(/^https:/, 'http:') + '/', { redirect: 'manual' })
check('HTTP upgrades to HTTPS', http.status === 308 || http.status === 301, `got ${http.status}`)
// Vercel edge 308 often omits HSTS; record it so the job still fails if HTTPS itself drops HSTS.
if (!(http.headers['strict-transport-security'] || '').includes('max-age')) {
  console.log('note: HTTP 308 has no HSTS (Vercel TLS hop)')
}

const img = await fetchRes('/_next/image?url=%2Fimages%2Fhero-delivery.jpg&w=640&q=75')
check('hero image 200', img.status === 200 && (img.headers['content-type'] || '').startsWith('image/'), `${img.status} ${img.headers['content-type']}`)

console.log('PASS', ok.length, ok.join(', '))
if (fail.length) {
  console.error('FAIL', fail.length)
  for (const f of fail) console.error(' -', f)
  process.exit(1)
}
console.log('live engine ok', BASE)
