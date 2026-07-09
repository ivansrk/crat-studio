/** Уникальный индекс нарушен (Prisma P2002) — например, гонка двух create по одному ключу. */
export function isUniqueViolation(e: unknown): boolean {
  return typeof e === 'object' && e !== null && (e as { code?: unknown }).code === 'P2002'
}
