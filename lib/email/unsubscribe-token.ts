import { createHmac, timingSafeEqual } from 'node:crypto'

const sig = (d: string, s: string) => createHmac('sha256', s).update(`unsub:${d}`).digest('base64url')

/** Токен отписки: base64url(email).hmac — таблица не нужна, email восстановим из токена. */
export function makeUnsubToken(email: string, secret: string): string {
  const p = Buffer.from(email.trim().toLowerCase()).toString('base64url')
  return `${p}.${sig(p, secret)}`
}
export function readUnsubToken(token: string, secret: string): string | null {
  const dot = token.lastIndexOf('.')
  if (dot < 1) return null
  const p = token.slice(0, dot), s = token.slice(dot + 1)
  const e = sig(p, secret)
  const a = Buffer.from(s), b = Buffer.from(e)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  try { return Buffer.from(p, 'base64url').toString() } catch { return null }
}
