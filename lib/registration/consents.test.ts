import { describe, it, expect } from 'vitest'
import { latestConsentByEmail } from './consents'

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
