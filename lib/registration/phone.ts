/** REG-16: телефон нормализуется до записи — trim, снятие форматирующих символов,
 *  ведущий `+` сохраняется, если он первый значащий символ; иначе отбрасывается вместе
 *  с прочим мусором (скобки, дефисы, пробелы, буквы). Меньше 7 цифр — телефон
 *  считается невалидным (пустой/нечисловой ввод тоже даёт null). */
export function normalizePhone(raw: string | null | undefined): string | null {
  const trimmed = (raw ?? '').trim()
  if (!trimmed) return null
  const hasLeadingPlus = trimmed.startsWith('+')
  const digits = trimmed.replace(/\D/g, '')
  if (digits.length < 7) return null
  return (hasLeadingPlus ? '+' : '') + digits
}
