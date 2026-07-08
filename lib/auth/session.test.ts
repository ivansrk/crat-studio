import { describe, it, expect } from 'vitest'
import { signSession, verifySession, SESSION_TTL_MS } from './session'

const SECRET = 'test-secret'

describe('session cookie', () => {
  it('подписывает и верифицирует userId', () => {
    const v = signSession('user-1', SECRET)
    expect(verifySession(v, SECRET)).toBe('user-1')
  })
  it('отклоняет подделку payload и подписи', () => {
    const v = signSession('user-1', SECRET)
    const [p, sig] = v.split('.')
    const forged = Buffer.from(JSON.stringify({ uid: 'user-2', exp: Date.now() + 1e6 })).toString('base64url')
    expect(verifySession(`${forged}.${sig}`, SECRET)).toBeNull()
    expect(verifySession(`${p}.AAAA`, SECRET)).toBeNull()
    expect(verifySession('мусор', SECRET)).toBeNull()
  })
  it('отклоняет истёкшую сессию', () => {
    const past = signSession('user-1', SECRET, Date.now() - SESSION_TTL_MS - 1000)
    expect(verifySession(past, SECRET)).toBeNull()
  })
  it('другой секрет — невалидно', () => {
    expect(verifySession(signSession('u', 'a'), 'b')).toBeNull()
  })
})
