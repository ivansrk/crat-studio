import { describe, it, expect, vi } from 'vitest'
import { latestConsentByEmail, isEffectivelyGranted, getEffectiveConsent } from './effective'

const row = (email: string, granted: boolean, at: number) =>
  ({ email, granted, createdAt: new Date(at) })

describe('latestConsentByEmail', () => {
  it('действующее = последняя запись по email', () => {
    const m = latestConsentByEmail([row('a@b.c', true, 1), row('a@b.c', false, 2)])
    expect(m.get('a@b.c')).toBe(false)
  })
  it('несколько email независимы', () => {
    const m = latestConsentByEmail([row('a@b.c', true, 5), row('x@y.z', false, 1), row('x@y.z', true, 2)])
    expect(m.get('a@b.c')).toBe(true)
    expect(m.get('x@y.z')).toBe(true)
  })
})

describe('isEffectivelyGranted', () => {
  it('пустой массив → false (согласия не было)', () => {
    expect(isEffectivelyGranted([])).toBe(false)
  })
  it('одна запись — её значение', () => {
    expect(isEffectivelyGranted([{ granted: true, createdAt: new Date(1) }])).toBe(true)
  })
  it('несколько записей — значение последней по createdAt, порядок во входном массиве не важен', () => {
    const rows = [
      { granted: true, createdAt: new Date(3000) },
      { granted: false, createdAt: new Date(1000) },
      { granted: false, createdAt: new Date(5000) },
      { granted: true, createdAt: new Date(2000) },
    ]
    expect(isEffectivelyGranted(rows)).toBe(false) // последняя по времени (5000) — granted=false
  })
})

describe('getEffectiveConsent', () => {
  function fakeClient(latest: { granted: boolean } | null) {
    const findFirst = vi.fn(async () => latest)
    return { client: { consent: { findFirst } } as never, findFirst }
  }

  it('нет записей → false', async () => {
    const { client } = fakeClient(null)
    expect(await getEffectiveConsent('a@b.c', 'NEWSLETTER', client)).toBe(false)
  })

  it('есть latest запись → её granted', async () => {
    const { client } = fakeClient({ granted: true })
    expect(await getEffectiveConsent('a@b.c', 'NEWSLETTER', client)).toBe(true)
  })

  it('email нормализуется (trim + lowercase) в запросе', async () => {
    const { client, findFirst } = fakeClient(null)
    await getEffectiveConsent('  A@B.C  ', 'NEWSLETTER', client)
    expect(findFirst).toHaveBeenCalledWith({ where: { email: 'a@b.c', type: 'NEWSLETTER' }, orderBy: { createdAt: 'desc' } })
  })
})
