/** Fail-fast: в проде без SESSION_SECRET работать нельзя (сессии были бы подделываемы). */
export function sessionSecret(): string {
  const s = process.env.SESSION_SECRET
  if (process.env.NODE_ENV === 'production') {
    if (!s) throw new Error('SESSION_SECRET не задан — вход невозможен (задать в Render Environment)')
    if (s.length < 32) throw new Error('SESSION_SECRET слишком короткий (нужно ≥32 символов)')
    return s
  }
  if (s) return s
  console.warn('[auth] SESSION_SECRET не задан — dev-режим использует небезопасный дефолт')
  return 'dev-insecure-secret'
}
