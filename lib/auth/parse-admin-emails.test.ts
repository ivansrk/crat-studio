import { describe, it, expect } from 'vitest'
import { parseAdminEmails } from './parse-admin-emails'

describe('parseAdminEmails', () => {
  it('парсит список с пробелами и регистром', () => {
    expect(parseAdminEmails(' A@B.c , d@E.f ')).toEqual(['a@b.c', 'd@e.f'])
  })
  it('пустые значения и undefined → []', () => {
    expect(parseAdminEmails(undefined)).toEqual([])
    expect(parseAdminEmails('')).toEqual([])
    expect(parseAdminEmails(' , ,')).toEqual([])
  })
  it('дубли схлопываются', () => {
    expect(parseAdminEmails('a@b.c,A@B.C')).toEqual(['a@b.c'])
  })
})
