import { createHmac, timingSafeEqual } from 'node:crypto'

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 дней (AUTH-07)
export const SESSION_COOKIE = 'crat_session'

const hmac = (data: string, secret: string) => createHmac('sha256', secret).update(data).digest('base64url')

/** Stateless-сессия (D-008): base64url(JSON{uid,exp}) + '.' + HMAC-SHA256. */
export function signSession(userId: string, secret: string, issuedAt = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ uid: userId, exp: issuedAt + SESSION_TTL_MS })).toString('base64url')
  return `${payload}.${hmac(payload, secret)}`
}

export function verifySession(value: string | undefined, secret: string, now = Date.now()): string | null {
  if (!value) return null
  const dot = value.lastIndexOf('.')
  if (dot < 1) return null
  const payload = value.slice(0, dot)
  const sig = value.slice(dot + 1)
  const expected = hmac(payload, secret)
  const a = Buffer.from(sig), b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  try {
    const { uid, exp } = JSON.parse(Buffer.from(payload, 'base64url').toString())
    if (typeof uid !== 'string' || typeof exp !== 'number' || exp < now) return null
    return uid
  } catch { return null }
}
