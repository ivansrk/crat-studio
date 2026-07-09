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

/** Первый вопрос без ответа (0..2) или null, если отвечены все. Дубли ответа на вопрос игнорируются (первый побеждает). */
export function nextQuestionIndex(answers: StoredAnswer[]): number | null {
  const answered = new Set(answers.map(a => a.questionIndex))
  for (let i = 0; i < QUIZ_TOTAL; i++) if (!answered.has(i)) return i
  return null
}
