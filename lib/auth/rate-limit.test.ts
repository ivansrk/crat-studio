import { describe, it, expect } from 'vitest'
import { RateLimiter } from './rate-limit'

describe('RateLimiter', () => {
  it('пускает limit попыток в окне и режет следующую', () => {
    const rl = new RateLimiter(3, 60_000)
    const t = 1_000_000
    expect(rl.allow('k', t)).toBe(true)
    expect(rl.allow('k', t + 1)).toBe(true)
    expect(rl.allow('k', t + 2)).toBe(true)
    expect(rl.allow('k', t + 3)).toBe(false)
  })
  it('окно скользит: старые попытки истекают', () => {
    const rl = new RateLimiter(1, 1000)
    expect(rl.allow('k', 0)).toBe(true)
    expect(rl.allow('k', 500)).toBe(false)
    expect(rl.allow('k', 1001)).toBe(true)
  })
  it('ключи независимы', () => {
    const rl = new RateLimiter(1, 1000)
    expect(rl.allow('a', 0)).toBe(true)
    expect(rl.allow('b', 0)).toBe(true)
  })
  it('память ограничена (LRU-подрезка)', () => {
    const rl = new RateLimiter(1, 1000, 100)
    for (let i = 0; i < 200; i++) rl.allow(`k${i}`, i)
    expect(rl.size).toBeLessThanOrEqual(100)
  })
})
