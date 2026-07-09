import { describe, it, expect } from 'vitest'
import { warsawDayStart, checkWindows, DAILY_LIMIT, MINUTE_LIMIT } from './limits'

describe('warsawDayStart', () => {
  it('зима (CET, UTC+1): 22:59 UTC — ещё предыдущий Warsaw-день', () => {
    const now = new Date('2026-01-15T22:59:00Z')
    expect(warsawDayStart(now)).toEqual(new Date('2026-01-14T23:00:00Z'))
  })
  it('зима (CET, UTC+1): 23:01 UTC — уже следующий Warsaw-день', () => {
    const now = new Date('2026-01-15T23:01:00Z')
    expect(warsawDayStart(now)).toEqual(new Date('2026-01-15T23:00:00Z'))
  })
  it('лето (CEST, UTC+2): 21:59 UTC — ещё предыдущий Warsaw-день', () => {
    const now = new Date('2026-07-15T21:59:00Z')
    expect(warsawDayStart(now)).toEqual(new Date('2026-07-14T22:00:00Z'))
  })
  it('лето (CEST, UTC+2): 22:01 UTC — уже следующий Warsaw-день', () => {
    const now = new Date('2026-07-15T22:01:00Z')
    expect(warsawDayStart(now)).toEqual(new Date('2026-07-15T22:00:00Z'))
  })
})

describe('checkWindows', () => {
  it('константы TRN-03', () => {
    expect(DAILY_LIMIT).toBe(20)
    expect(MINUTE_LIMIT).toBe(3)
  })

  const now = new Date('2026-07-15T12:00:00Z') // летний Warsaw-день начинается в 2026-07-14T22:00:00Z
  const dayStart = warsawDayStart(now)
  const todayAgo = (msAgo: number) => new Date(now.getTime() - msAgo)
  const todaySpread = (n: number) => Array.from({ length: n }, (_, i) => todayAgo(3_600_000 + i * 1000)) // раскидано по дню, вне минутного окна

  it('19 сегодня → ok', () => {
    expect(checkWindows(todaySpread(19), now)).toBe('ok')
  })
  it('20 сегодня → daily', () => {
    expect(checkWindows(todaySpread(20), now)).toBe('daily')
  })
  it('3 за минуту → minute', () => {
    const used = [todayAgo(10_000), todayAgo(20_000), todayAgo(30_000)]
    expect(checkWindows(used, now)).toBe('minute')
  })
  it('вчерашние не считаются', () => {
    const yesterday = Array.from({ length: 25 }, (_, i) => new Date(dayStart.getTime() - 1_000 - i * 1_000))
    expect(checkWindows(yesterday, now)).toBe('ok')
  })
  it('ровно 60с назад — вне минутного окна (не считается к лимиту минуты)', () => {
    const used = [todayAgo(60_000), todayAgo(30_000), todayAgo(10_000)]
    expect(checkWindows(used, now)).toBe('ok') // в окне только 2 из 3 (граничная запись не считается)
  })
})
