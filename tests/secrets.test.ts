import { beforeEach, describe, expect, it, vi } from 'vitest'

const TEST_MASTER = 'test-master-secret-0123456789abcdef'

async function loadSecrets() {
  vi.resetModules()
  // A v2 key stubbed by an earlier loader in the same test must not leak
  // into this one: the no-key fallback is what these tests assert.
  vi.unstubAllEnvs()
  vi.stubEnv('BETTER_AUTH_SECRET', TEST_MASTER)
  return await import('../lib/secrets')
}

describe('secrets encryption', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
  })

  it('round-trips encrypt -> decrypt', async () => {
    const { encryptSecret, decryptSecret } = await loadSecrets()
    const enc = encryptSecret('mono-token-abc123')
    expect(enc.startsWith('enc:v1:')).toBe(true)
    expect(enc).not.toContain('mono-token-abc123')
    expect(decryptSecret(enc)).toBe('mono-token-abc123')
  })

  it('produces different ciphertexts for the same plaintext (random IV)', async () => {
    const { encryptSecret } = await loadSecrets()
    expect(encryptSecret('same')).not.toBe(encryptSecret('same'))
  })

  it('encrypt is idempotent (no double encryption)', async () => {
    const { encryptSecret } = await loadSecrets()
    const once = encryptSecret('secret')
    expect(encryptSecret(once)).toBe(once)
  })

  it('decrypt passes plaintext through (pre-migration rows keep working)', async () => {
    const { decryptSecret } = await loadSecrets()
    expect(decryptSecret('plain-old-token')).toBe('plain-old-token')
    expect(decryptSecret('')).toBe('')
    expect(decryptSecret(null)).toBe('')
    expect(decryptSecret(undefined)).toBe('')
  })

  it('encrypt passes empty values through', async () => {
    const { encryptSecret } = await loadSecrets()
    expect(encryptSecret('')).toBe('')
  })

  it('fails closed when BETTER_AUTH_SECRET is missing', async () => {
    vi.resetModules()
    vi.stubEnv('BETTER_AUTH_SECRET', '')
    const { encryptSecret } = await import('../lib/secrets')
    expect(() => encryptSecret('x')).toThrow(/BETTER_AUTH_SECRET/)
  })

  it('rejects tampered ciphertext', async () => {
    const { encryptSecret, decryptSecret } = await loadSecrets()
    const enc = encryptSecret('secret')
    const tampered = enc.slice(0, -4) + 'AAAA'
    expect(() => decryptSecret(tampered)).toThrow()
  })

  it('rejects ciphertext encrypted under a different master secret', async () => {
    const first = await loadSecrets()
    const enc = first.encryptSecret('secret')
    vi.resetModules()
    vi.stubEnv('BETTER_AUTH_SECRET', 'a-different-master-secret-xyz')
    const second = await import('../lib/secrets')
    expect(() => second.decryptSecret(enc)).toThrow()
  })

  it('encryptConfigSecrets / decryptConfigSecrets touch only listed keys', async () => {
    const { encryptConfigSecrets, decryptConfigSecrets, decryptSecret } = await loadSecrets()
    const cfg = { token: 'tok123', merchantAccount: 'acc', note: '' }
    const enc = encryptConfigSecrets(cfg, ['token'])
    expect(enc.token).not.toBe('tok123')
    expect(enc.merchantAccount).toBe('acc')
    expect(enc.note).toBe('')
    // original not mutated
    expect(cfg.token).toBe('tok123')
    const dec = decryptConfigSecrets(enc, ['token'])
    expect(dec.token).toBe('tok123')
    // decrypting an already-plain config is a no-op
    expect(decryptSecret(decryptConfigSecrets(cfg, ['token']).token)).toBe('tok123')
  })

  it('encrypts the delivery apiKey (REGRESSION: was stored in plaintext)', async () => {
    const { encryptConfigSecrets, decryptConfigSecrets, DELIVERY_CONFIG_SECRET_KEYS } = await loadSecrets()
    const cfg = { apiKey: 'live_np_key_123', senderCityRef: 'city-ref', other: 'x' }
    const enc = encryptConfigSecrets(cfg, DELIVERY_CONFIG_SECRET_KEYS)
    expect(enc.apiKey).not.toBe('live_np_key_123')
    expect(enc.apiKey.startsWith('enc:v1:')).toBe(true)
    expect(enc.senderCityRef).toBe('city-ref')
    expect(enc.other).toBe('x')
    // read path (getNovaPoshtaKey) recovers the key; legacy plaintext rows pass through
    const dec = decryptConfigSecrets(enc, DELIVERY_CONFIG_SECRET_KEYS)
    expect(dec.apiKey).toBe('live_np_key_123')
    expect(decryptConfigSecrets(cfg, DELIVERY_CONFIG_SECRET_KEYS).apiKey).toBe('live_np_key_123')
  })

  // --- enc:v2 (audit item 39): dedicated APP_ENCRYPTION_KEY ---
  async function loadSecretsV2() {
    vi.resetModules()
    vi.stubEnv('BETTER_AUTH_SECRET', TEST_MASTER)
    vi.stubEnv('APP_ENCRYPTION_KEY', 'test-encryption-key-0123456789abcdef')
    return await import('../lib/secrets')
  }

  it('encrypts as enc:v2 when APP_ENCRYPTION_KEY is set', async () => {
    const { encryptSecret, decryptSecret } = await loadSecretsV2()
    const enc = encryptSecret('mono-token-abc123')
    expect(enc.startsWith('enc:v2:')).toBe(true)
    expect(enc).not.toContain('mono-token-abc123')
    expect(decryptSecret(enc)).toBe('mono-token-abc123')
  })

  it('still decrypts enc:v1 values when the v2 key is set (backward compat)', async () => {
    const v1 = await loadSecrets()
    const encV1 = v1.encryptSecret('old-gateway-secret')
    expect(encV1.startsWith('enc:v1:')).toBe(true)
    const v2 = await loadSecretsV2()
    expect(v2.decryptSecret(encV1)).toBe('old-gateway-secret')
    // and a v2 value is idempotent under encrypt
    expect(v2.encryptSecret(encV1)).toBe(encV1)
  })

  it('decrypting enc:v2 without APP_ENCRYPTION_KEY throws (fail closed)', async () => {
    const v2 = await loadSecretsV2()
    const encV2 = v2.encryptSecret('telegram-token')
    const noKey = await loadSecrets()
    expect(() => noKey.decryptSecret(encV2)).toThrow('APP_ENCRYPTION_KEY')
  })

  it('isEncryptedSecret accepts both prefixes', async () => {
    const { isEncryptedSecret } = await loadSecretsV2()
    expect(isEncryptedSecret('enc:v1:abc')).toBe(true)
    expect(isEncryptedSecret('enc:v2:abc')).toBe(true)
    expect(isEncryptedSecret('plain')).toBe(false)
  })
})
