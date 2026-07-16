/** Чистая логика квиза — единственное место с порогом зачёта (D-004, LES-08). */
export const QUIZ_TOTAL = 3
export const PASS_SCORE = 2

export type StoredAnswer = { questionIndex: number; chosen: number; correct: boolean }

export const scoreAnswers = (answers: StoredAnswer[]): number => {
  const byQuestion = new Map<number, boolean>()
  for (const a of answers) if (!byQuestion.has(a.questionIndex)) byQuestion.set(a.questionIndex, a.correct)
  return [...byQuestion.values()].filter(Boolean).length
}

export const isQuizPassed = (score: number): boolean => score >= PASS_SCORE

/** Правило 9/D-004/E16: единственное ЖИВОЕ определение «урок пройден» — квиз зачтён И практика отмечена.
 *  completedAt не участвует (это тайминг deferred, не откатывается). Type guard, чтобы после проверки
 *  вызывающий код работал с датами без non-null-assertions (админ-колонка «Пройден» берёт max двух дат). */
export function isLessonPassed<T extends { quizPassedAt: Date | null; practiceDoneAt: Date | null }>(
  p: T | null | undefined,
): p is T & { quizPassedAt: Date; practiceDoneAt: Date } {
  return !!p?.quizPassedAt && !!p?.practiceDoneAt
}

/** S8 (аудит навигации 2026-07-16, NAV-09): первый НЕ пройденный урок курса — цель кнопки
 *  «Продолжить». Идёт по уроками в порядке course.yaml (как их передал вызывающий), возвращает
 *  первый, для которого isLessonPassed ложно (тот же критерий LES-12, что и везде), или null,
 *  если пройдены все (тогда кнопки «Продолжить урок» нет — следующий шаг это финальный проект,
 *  чей блок с CTA уже виден ниже на странице курса). Чистая функция без БД — тестируется отдельно. */
export function firstUnpassedLesson<
  P extends { quizPassedAt: Date | null; practiceDoneAt: Date | null },
  L extends { id: string },
>(lessons: L[], byLesson: Map<string, P | undefined>): L | null {
  for (const l of lessons) if (!isLessonPassed(byLesson.get(l.id))) return l
  return null
}

/** Идемпотентный повтор ответа (двойной клик, ревью T2): вопрос уже отвечен ТЕМ ЖЕ chosen →
 *  сохранённая запись; иначе null (реальный out-of-order). Первый ответ побеждает (как в scoreAnswers). */
export function isReplay(answers: StoredAnswer[], questionIndex: number, chosen: number): StoredAnswer | null {
  const saved = answers.find(a => a.questionIndex === questionIndex)
  return saved && saved.chosen === chosen ? saved : null
}

/** Валидный индекс варианта: целое в [0, optionsCount). Number('мусор') из формы даёт NaN —
 *  сравнения с NaN ложны, поэтому явный isInteger (ревью T5). */
export function isValidChoice(chosen: number, optionsCount: number): boolean {
  return Number.isInteger(chosen) && chosen >= 0 && chosen < optionsCount
}

/** Первый вопрос без ответа (0..2) или null, если отвечены все. Дубли ответа на вопрос игнорируются (первый побеждает). */
export function nextQuestionIndex(answers: StoredAnswer[]): number | null {
  const answered = new Set(answers.map(a => a.questionIndex))
  for (let i = 0; i < QUIZ_TOTAL; i++) if (!answered.has(i)) return i
  return null
}
