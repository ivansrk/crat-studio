import { randomInt } from 'node:crypto'
import bcrypt from 'bcryptjs'

// D-032: bcryptjs (чистый JS, без нативных сборок) — Render собирает образ на каждый деплой,
// нативные зависимости (argon2) рискуют падением билда. Cost-фактор 12 достаточен: наш пароль
// генерируется сервером и уже высокой энтропии (см. generatePassword ниже).
const BCRYPT_COST = 12

// D-033: алфавит без визуально неоднозначных символов (0/O, 1/l/I), чтобы пароль было легко
// ввести вручную с телефона по письму.
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'
const GROUP_LEN = 4
const GROUP_COUNT = 3

/** Генерирует человекочитаемый пароль вида xxxx-xxxx-xxxx (12+ символов без разделителей,
 *  D-033). Символы берутся криптостойким генератором node:crypto.randomInt, поэтому пароль
 *  пригоден как единственный секрет при первом входе. */
export function generatePassword(): string {
  const groups: string[] = []
  for (let g = 0; g < GROUP_COUNT; g++) {
    let group = ''
    for (let i = 0; i < GROUP_LEN; i++) {
      group += ALPHABET[randomInt(ALPHABET.length)]
    }
    groups.push(group)
  }
  return groups.join('-')
}

/** Хэширует сырой пароль bcrypt-ом (cost 12, D-032). Хэш самодостаточен (соль внутри) —
 *  хранить только его, сырой пароль нигде не сохраняется. */
export function hashPassword(raw: string): Promise<string> {
  return bcrypt.hash(raw, BCRYPT_COST)
}

/** Сверяет сырой пароль с хэшем из базы. */
export function verifyPassword(raw: string, hash: string): Promise<boolean> {
  return bcrypt.compare(raw, hash)
}
