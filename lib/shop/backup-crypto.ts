/**
 * Shared backup encryption helpers (3.4.109).
 *
 * Nightly backups are encrypted with AES-256-GCM, compress-then-encrypt
 * (gzip first — encrypted bytes do not compress), streaming, never
 * buffering a whole dump. One file, one artifact: a small plaintext header
 * up front, then ciphertext, GCM tag last.
 *
 * File layout (new extension `.jsonl.gz.enc`):
 *   [8-byte magic "PFBKUP01"][2-byte header length, big-endian][JSON header][ciphertext][16-byte GCM tag]
 * JSON header (plaintext — contains no sensitive data):
 *   { "v": 1, "alg": "aes-256-gcm", "keyId": "2026-12", "nonce": "<base64>" }
 *
 * Key: a dedicated 32-byte key, base64 in env as BACKUP_ENCRYPTION_KEY
 * (generate with `openssl rand -base64 32`). The current key's keyId is
 * BACKUP_ENCRYPTION_KEY_ID when set, otherwise the current UTC month
 * (`YYYY-MM`) — so the header always names which key a backup needs.
 * Retained old keys live in BACKUP_ENCRYPTION_KEY_<keyId> (e.g.
 * BACKUP_ENCRYPTION_KEY_2026-11). Losing a key strands every backup
 * encrypted under its keyId — permanently, by design (see
 * docs/db-backup.md, "If the key is lost").
 *
 * The restore script (scripts/db-restore-backup.mjs, plain Node) cannot
 * import this TS module, so it re-implements the same wire format — keep
 * the constants below in sync with it (see the note at the top of that
 * file). The two implementations are cross-checked by
 * tests/db-backup-encryption.test.ts, which builds encrypted dumps with
 * this module and restores them with that script.
 *
 * Server-side only. Never import from a 'use client' module.
 */
import { createCipheriv, createDecipheriv, randomBytes, type CipherGCM, type DecipherGCM } from 'node:crypto'
import { Transform } from 'node:stream'

export const BACKUP_MAGIC = 'PFBKUP01'
export const BACKUP_FORMAT_VERSION = 1
export const BACKUP_ALGORITHM = 'aes-256-gcm'
export const BACKUP_NONCE_BYTES = 12
export const BACKUP_TAG_BYTES = 16
export const BACKUP_KEY_BYTES = 32
export const BACKUP_ENCRYPTION_KEY_ENV = 'BACKUP_ENCRYPTION_KEY'
export const BACKUP_ENCRYPTION_KEY_ID_ENV = 'BACKUP_ENCRYPTION_KEY_ID'
export const BACKUP_ENCRYPTED_SUFFIX = '.jsonl.gz.enc'
export const BACKUP_PLAINTEXT_SUFFIX = '.jsonl.gz'

export interface BackupHeader {
  v: 1
  alg: 'aes-256-gcm'
  keyId: string
  /** base64 of the 12-byte nonce */
  nonce: string
}

/** The keyId stamped on backups written with the current key. */
export function currentBackupKeyId(env: NodeJS.ProcessEnv = process.env): string {
  const explicit = env[BACKUP_ENCRYPTION_KEY_ID_ENV]?.trim()
  if (explicit) return explicit
  const now = new Date()
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
}

function decodeBackupKey(raw: string | undefined, envVar: string): Buffer {
  if (!raw || !raw.trim()) {
    throw new Error(
      `[backup-crypto] ${envVar} is not set — cannot encrypt/decrypt backups without it. ` +
        'Generate one with: openssl rand -base64 32',
    )
  }
  const value = raw.trim()
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value)) {
    throw new Error(`[backup-crypto] ${envVar} is not valid base64 — expected the output of: openssl rand -base64 32`)
  }
  const key = Buffer.from(value, 'base64')
  if (key.length !== BACKUP_KEY_BYTES) {
    throw new Error(
      `[backup-crypto] ${envVar} must decode to ${BACKUP_KEY_BYTES} bytes (generate with: openssl rand -base64 32), ` +
        `got ${key.length}.`,
    )
  }
  return key
}

/**
 * Resolve the key for a backup stamped with `keyId`: a retained old key in
 * BACKUP_ENCRYPTION_KEY_<keyId> wins; otherwise the current key in
 * BACKUP_ENCRYPTION_KEY applies when `keyId` is the current key id.
 * Unknown keyId → a clear error naming the keyId and the env var that
 * should hold it (a GCM tag failure would only say "decrypt failed").
 */
export function resolveBackupKey(keyId: string, env: NodeJS.ProcessEnv = process.env): Buffer {
  if (!keyId || typeof keyId !== 'string') {
    throw new Error('[backup-crypto] backup header has no keyId — the file is corrupt or not an encrypted backup.')
  }
  const retainedVar = `${BACKUP_ENCRYPTION_KEY_ENV}_${keyId}`
  const retained = env[retainedVar]
  if (retained) return decodeBackupKey(retained, retainedVar)
  if (keyId === currentBackupKeyId(env)) {
    const current = env[BACKUP_ENCRYPTION_KEY_ENV]
    if (current) return decodeBackupKey(current, BACKUP_ENCRYPTION_KEY_ENV)
  }
  throw new Error(
    `[backup-crypto] Unknown backup keyId "${keyId}": no key found. ` +
      `Set ${retainedVar} to the 32-byte base64 key that encrypted this backup ` +
      `(or ${BACKUP_ENCRYPTION_KEY_ENV} if "${keyId}" is the current key id). ` +
      'Without that key the backup cannot be decrypted — see docs/db-backup.md, "If the key is lost".',
  )
}

/**
 * The key + keyId the writer uses. FAILS CLOSED when
 * BACKUP_ENCRYPTION_KEY is unset — refusing to write an unencrypted
 * backup (a silent plaintext fallback would repeat the exact failure mode
 * encryption exists to fix).
 */
export function currentBackupKey(env: NodeJS.ProcessEnv = process.env): { key: Buffer; keyId: string } {
  const keyId = currentBackupKeyId(env)
  const raw = env[BACKUP_ENCRYPTION_KEY_ENV]
  if (!raw || !raw.trim()) {
    throw new Error(
      `[backup-crypto] ${BACKUP_ENCRYPTION_KEY_ENV} is not set — refusing to write an unencrypted backup. ` +
        'Generate one with: openssl rand -base64 32 (see docs/db-backup.md).',
    )
  }
  return { key: decodeBackupKey(raw, BACKUP_ENCRYPTION_KEY_ENV), keyId }
}

/** Serialize a header to its on-disk form (magic + 2-byte length + JSON). */
export function encodeBackupHeader(header: BackupHeader): Buffer {
  const json = Buffer.from(JSON.stringify(header), 'utf8')
  const out = Buffer.alloc(8 + 2 + json.length)
  out.write(BACKUP_MAGIC, 0, 'ascii')
  out.writeUInt16BE(json.length, 8)
  json.copy(out, 10)
  return out
}

/** Parse (and validate) a header from the start of a buffer. */
export function decodeBackupHeader(buf: Buffer): { header: BackupHeader; headerLength: number } {
  if (buf.length < 10) {
    throw new Error('[backup-crypto] backup file is too short to contain an encrypted-backup header (expected at least 10 bytes).')
  }
  if (buf.subarray(0, 8).toString('ascii') !== BACKUP_MAGIC) {
    throw new Error('[backup-crypto] backup file does not start with the encrypted-backup magic "PFBKUP01" — not an encrypted backup (or the file is corrupt).')
  }
  const jsonLength = buf.readUInt16BE(8)
  if (buf.length < 10 + jsonLength) {
    throw new Error('[backup-crypto] truncated backup header: the file ends inside the JSON header.')
  }
  let header: unknown
  try {
    header = JSON.parse(buf.subarray(10, 10 + jsonLength).toString('utf8'))
  } catch {
    throw new Error('[backup-crypto] backup header is not valid JSON — the file is corrupt.')
  }
  if (
    !header ||
    typeof header !== 'object' ||
    (header as { v?: unknown }).v !== BACKUP_FORMAT_VERSION ||
    (header as { alg?: unknown }).alg !== BACKUP_ALGORITHM ||
    typeof (header as { keyId?: unknown }).keyId !== 'string' ||
    !(header as { keyId: string }).keyId ||
    typeof (header as { nonce?: unknown }).nonce !== 'string' ||
    !(header as { nonce: string }).nonce
  ) {
    throw new Error(
      '[backup-crypto] unsupported encrypted-backup header (expected { v: 1, alg: "aes-256-gcm", keyId, nonce }).',
    )
  }
  const nonce = Buffer.from((header as BackupHeader).nonce, 'base64')
  if (nonce.length !== BACKUP_NONCE_BYTES) {
    throw new Error(`[backup-crypto] invalid nonce in backup header (expected ${BACKUP_NONCE_BYTES} bytes).`)
  }
  return { header: header as BackupHeader, headerLength: 10 + jsonLength }
}

/** True when the buffer starts with the encrypted-backup magic. */
export function isEncryptedBackupMagic(buf: Buffer): boolean {
  return buf.length >= 8 && buf.subarray(0, 8).toString('ascii') === BACKUP_MAGIC
}

/**
 * A Transform that writes the plaintext header first, then AES-256-GCM
 * ciphertext, then the 16-byte tag last. Feed it gzipped bytes (the
 * writer's pipeline is NDJSON rows → gzip → this → disk).
 * A fresh random 12-byte nonce is generated per stream (per backup).
 */
export class BackupEncryptStream extends Transform {
  private readonly cipher: CipherGCM
  private readonly header: Buffer
  private headerWritten = false

  constructor(key: Buffer, keyId: string) {
    super()
    const nonce = randomBytes(BACKUP_NONCE_BYTES)
    this.cipher = createCipheriv(BACKUP_ALGORITHM, key, nonce)
    this.header = encodeBackupHeader({ v: 1, alg: BACKUP_ALGORITHM, keyId, nonce: nonce.toString('base64') })
  }

  _transform(chunk: Buffer, _encoding: string, callback: (err?: Error | null) => void): void {
    try {
      if (!this.headerWritten) {
        this.push(this.header)
        this.headerWritten = true
      }
      this.push(this.cipher.update(chunk))
      callback()
    } catch (e) {
      callback(e as Error)
    }
  }

  _flush(callback: (err?: Error | null) => void): void {
    try {
      if (!this.headerWritten) {
        this.push(this.header)
        this.headerWritten = true
      }
      this.push(this.cipher.final())
      this.push(this.cipher.getAuthTag())
      callback()
    } catch (e) {
      callback(e as Error)
    }
  }
}

/**
 * A Transform that decrypts ciphertext whose last 16 bytes are the GCM
 * tag. Feed it ciphertext WITHOUT the header (the header is parsed
 * separately, e.g. by decodeBackupHeader). The tag is held back from the
 * cipher until the stream ends, then verified: a wrong key or any tampered
 * byte fails here (decipher.final() throws "Unable to authenticate
 * data"), never silently.
 */
export class BackupDecryptStream extends Transform {
  private readonly decipher: DecipherGCM
  private tail: Buffer = Buffer.alloc(0)

  constructor(key: Buffer, nonce: Buffer) {
    super()
    this.decipher = createDecipheriv(BACKUP_ALGORITHM, key, nonce)
  }

  _transform(chunk: Buffer, _encoding: string, callback: (err?: Error | null) => void): void {
    try {
      const data = Buffer.concat([this.tail, chunk])
      if (data.length <= BACKUP_TAG_BYTES) {
        // Not enough bytes yet to know where ciphertext ends and the tag
        // begins — hold everything back.
        this.tail = data
        callback()
        return
      }
      const cut = data.length - BACKUP_TAG_BYTES
      this.tail = data.subarray(cut)
      this.push(this.decipher.update(data.subarray(0, cut)))
      callback()
    } catch (e) {
      callback(e as Error)
    }
  }

  _flush(callback: (err?: Error | null) => void): void {
    try {
      if (this.tail.length !== BACKUP_TAG_BYTES) {
        throw new Error('[backup-crypto] encrypted backup is truncated: the 16-byte GCM tag is missing.')
      }
      this.decipher.setAuthTag(this.tail)
      // Throws on a wrong key or any tampered byte — fail closed.
      this.push(this.decipher.final())
      callback()
    } catch (e) {
      callback(e as Error)
    }
  }
}

async function collect(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks)
}

/** Encrypt whole bytes (header + ciphertext + tag). Convenience for tests and smoke checks. */
export async function encryptBackupBytes(plain: Buffer, key: Buffer, keyId: string): Promise<Buffer> {
  const { Readable } = await import('node:stream')
  const out = Readable.from([plain]).pipe(new BackupEncryptStream(key, keyId))
  return collect(out)
}

/** Decrypt whole bytes produced by encryptBackupBytes (key resolved by keyId from env). */
export async function decryptBackupBytes(encrypted: Buffer, env: NodeJS.ProcessEnv = process.env): Promise<Buffer> {
  const { header, headerLength } = decodeBackupHeader(encrypted)
  const key = resolveBackupKey(header.keyId, env)
  const nonce = Buffer.from(header.nonce, 'base64')
  const { Readable } = await import('node:stream')
  const out = Readable.from([encrypted.subarray(headerLength)]).pipe(new BackupDecryptStream(key, nonce))
  return collect(out)
}

