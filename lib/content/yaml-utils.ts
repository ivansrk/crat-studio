import fs from 'node:fs'
import path from 'node:path'
import * as yaml from 'js-yaml'

/** Непустая строка. YAML отдаёт числа/даты как есть — `?.trim()` на числе бросает TypeError, поэтому сначала typeof. */
export function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0
}

export function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === 'object' && !Array.isArray(v)
}

/** Общий для loader.ts и articles.ts. Ошибки — через err-коллбек, никогда не бросает. */
export function readYaml<T>(p: string, err: (m: string) => void): T | null {
  const raw = readFile(p, err)
  if (raw === null) return null
  let parsed: unknown
  // loadAll: пустой файл / файл из одних комментариев даёт [], а не исключение (в отличие от load в js-yaml v5)
  try { parsed = yaml.loadAll(raw)[0] } catch (e) { err(`${path.basename(p)} не парсится: ${(e as Error).message}`); return null }
  if (!isPlainObject(parsed)) {
    err(`${path.basename(p)} пуст или не является объектом`)
    return null
  }
  return parsed as T
}

export function readFile(p: string, err: (m: string) => void): string | null {
  if (!fs.existsSync(p)) { err(`отсутствует обязательный файл ${path.basename(p)}`); return null }
  return fs.readFileSync(p, 'utf8')
}
