/** D-052 (редакционный лонгрид): оглавление статьи и время чтения. Чистые функции
 *  над сырым MDX — без чтения файлов, без API. */

export type Heading = { text: string; slug: string }

/**
 * Slug для якоря заголовка. Юникод-безопасный (кириллица сохраняется, регистр вниз,
 * не-буквенно-цифровое → дефис). Тот же алгоритм применяет рендер h2 на странице
 * статьи, чтобы id совпадал с href оглавления.
 */
export function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * h2-заголовки (## …) из markdown статьи — для блока «В этой статье». Только уровень 2
 * (### и глубже игнорируются). Дубли слагов разводятся суффиксом -1, -2 …
 */
export function extractH2(mdx: string): Heading[] {
  const out: Heading[] = []
  const seen = new Map<string, number>()
  for (const line of mdx.split('\n')) {
    const m = /^##[ \t]+(.+?)[ \t]*$/.exec(line)
    if (!m) continue
    const text = m[1].replace(/[*_`]/g, '').trim()
    if (!text) continue
    const base = slugifyHeading(text)
    const n = seen.get(base) ?? 0
    seen.set(base, n + 1)
    out.push({ text, slug: n > 0 ? `${base}-${n}` : base })
  }
  return out
}

/**
 * Время чтения в минутах (≥1). Считается из текста автоматически (слов / 200) —
 * в мету не выносится (решение владельца). Грубо снимаем теги компонентов и
 * markdown-пунктуацию, считаем «слова» по пробелам.
 */
export function readingTimeMin(mdx: string): number {
  const words = mdx
    .replace(/<[^>]*>/g, ' ')
    .replace(/[#>*_`~|=\-]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length
  return Math.max(1, Math.round(words / 200))
}
