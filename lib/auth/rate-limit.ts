/** In-memory скользящее окно (D-015): рестарт сбрасывает счётчики — приемлемо для anti-abuse. */
export class RateLimiter {
  private hits = new Map<string, number[]>()
  constructor(private limit: number, private windowMs: number, private maxKeys = 10_000) {}

  allow(key: string, now = Date.now()): boolean {
    const list = (this.hits.get(key) ?? []).filter(ts => now - ts < this.windowMs)
    if (list.length >= this.limit) { this.hits.set(key, list); return false }
    list.push(now)
    this.hits.delete(key) // переставляем в конец Map — дешёвый LRU
    this.hits.set(key, list)
    if (this.hits.size > this.maxKeys) this.hits.delete(this.hits.keys().next().value!)
    return true
  }
  /** Сбрасывает счётчик ключа (например, после успешного входа — AUTH-20). */
  reset(key: string): void { this.hits.delete(key) }
  get size() { return this.hits.size }
}

// Синглтоны на процесс (globalThis — переживают HMR):
const g = globalThis as unknown as { __rl?: Record<string, RateLimiter> }
g.__rl ??= {
  registration: new RateLimiter(5, 60 * 60 * 1000), // REG-07: 5/час/IP
  magicLink: new RateLimiter(3, 15 * 60 * 1000),    // AUTH-08: 3/15мин/email
  magicLinkIp: new RateLimiter(10, 15 * 60 * 1000), // SEC-03: 10/15мин/IP — против перебора многих email
  loginEmail: new RateLimiter(10, 15 * 60 * 1000),  // AUTH-20: 10/15мин/email — перебор пароля
  loginIp: new RateLimiter(20, 15 * 60 * 1000),     // AUTH-20: 20/15мин/IP — перебор многих email
}
export const limiters = g.__rl
