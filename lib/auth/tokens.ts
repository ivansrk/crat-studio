import { createHash, randomBytes } from 'node:crypto'

// Общие token-хелперы для всей token-механики (magic-link T8, reset Ф7а T4, будущий opt-in Ф7б):
// сырой токен уходит только в письмо/URL, в базе живёт только хэш (D-028, D-009).
export const newToken = () => randomBytes(32).toString('hex')
export const hashToken = (raw: string) => createHash('sha256').update(raw).digest('hex') // D-009
