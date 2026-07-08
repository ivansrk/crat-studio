/** Fail-fast: в проде без SESSION_SECRET работать нельзя (сессии были бы подделываемы). */
export function sessionSecret(): string {
  const s = process.env.SESSION_SECRET
  if (s) return s
  if (process.env.NODE_ENV === 'production') throw new Error('SESSION_SECRET не задан — вход невозможен (задать в Render Environment)')
  console.warn('[auth] SESSION_SECRET не задан — dev-режим использует небезопасный дефолт')
  return 'dev-insecure-secret'
}
