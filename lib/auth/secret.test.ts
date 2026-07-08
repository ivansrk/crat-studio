import { describe, it, expect, vi, afterEach } from 'vitest'
import { sessionSecret } from './secret'

afterEach(() => vi.unstubAllEnvs())

describe('sessionSecret', () => {
  it('возвращает SESSION_SECRET, если задан', () => {
    vi.stubEnv('SESSION_SECRET', 'real-secret')
    expect(sessionSecret()).toBe('real-secret')
  })
  it('прод с валидным длинным секретом возвращает его', () => {
    const long = 'a'.repeat(48)
    vi.stubEnv('SESSION_SECRET', long)
    vi.stubEnv('NODE_ENV', 'production')
    expect(sessionSecret()).toBe(long)
  })
  it('прод с коротким секретом → throw', () => {
    vi.stubEnv('SESSION_SECRET', 'abc')
    vi.stubEnv('NODE_ENV', 'production')
    expect(() => sessionSecret()).toThrow('слишком короткий')
  })
  it('прод без SESSION_SECRET → throw (fail-fast)', () => {
    vi.stubEnv('SESSION_SECRET', '')
    vi.stubEnv('NODE_ENV', 'production')
    expect(() => sessionSecret()).toThrow('SESSION_SECRET')
  })
  it('dev без SESSION_SECRET → небезопасный дефолт с предупреждением', () => {
    vi.stubEnv('SESSION_SECRET', '')
    vi.stubEnv('NODE_ENV', 'development')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(sessionSecret()).toBe('dev-insecure-secret')
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })
})
