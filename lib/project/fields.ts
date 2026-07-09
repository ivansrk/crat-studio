/** Поля отчёта мини-проекта (PROJ-01). Порядок = порядок вопросов формы (T5). */
export const PROJECT_FIELDS = ['task', 'tool', 'prompt', 'result', 'refined', 'verified', 'application'] as const
export type ProjectField = (typeof PROJECT_FIELDS)[number]
export type ProjectDraft = Record<ProjectField, string | null>

const MAX_LEN = 5000

/** Черновик можно сохранять частично; для ОТПРАВКИ все 7 полей непустые (PROJ-01/03).
 *  trim → пустая строка (в т.ч. только пробелы) становится null → обрезка до 5000 символов.
 *  Не-строковые/отсутствующие значения → null (защита от подделанного FormData). */
export function normalizeDraft(input: Record<string, unknown>): ProjectDraft {
  const draft = {} as ProjectDraft
  for (const field of PROJECT_FIELDS) {
    const raw = input[field]
    if (typeof raw !== 'string') {
      draft[field] = null
      continue
    }
    const trimmed = raw.trim()
    draft[field] = trimmed === '' ? null : trimmed.slice(0, MAX_LEN)
  }
  return draft
}

/** Готов к отправке на проверку — все 7 полей непустые (PROJ-01).
 *  Ожидает УЖЕ нормализованный draft (normalizeDraft); whitespace-строки не перепроверяет. */
export function isSubmittable(d: ProjectDraft): boolean {
  return PROJECT_FIELDS.every(f => !!d[f])
}
