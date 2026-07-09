import { describe, it, expect } from 'vitest'
import { buildNewsletterCsv } from './newsletter-csv'

describe('buildNewsletterCsv', () => {
  const consent = (email: string, granted: boolean, at: number) => ({ email, granted, createdAt: new Date(at) })
  const reg = (email: string, firstName = 'И', lastName = 'С', phone: string | null = null, telegram: string | null = null) =>
    ({ email, firstName, lastName, phone, telegram })

  it('только действующее согласие NEWSLETTER попадает в CSV', () => {
    const csv = buildNewsletterCsv(
      [reg('yes@a.b'), reg('no@a.b'), reg('revoked@a.b')],
      [consent('yes@a.b', true, 1), consent('no@a.b', false, 1), consent('revoked@a.b', true, 1), consent('revoked@a.b', false, 2)],
    )
    expect(csv).toContain('yes@a.b')
    expect(csv).not.toContain('no@a.b')
    expect(csv).not.toContain('revoked@a.b')
  })
  it('экранирует запятые/кавычки и содержит дату согласия', () => {
    const csv = buildNewsletterCsv([reg('a@b.c', 'Имя, с запятой', 'Фа"милия')], [consent('a@b.c', true, 1700000000000)])
    expect(csv).toContain('"Имя, с запятой"')
    expect(csv).toContain('"Фа""милия"')
    expect(csv.split('\n')[0]).toBe('firstName,lastName,email,phone,telegram,consentDate')
  })
})
