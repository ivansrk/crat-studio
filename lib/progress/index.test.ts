import { describe, it, expect, vi, beforeEach } from 'vitest'

// startAttempt/ensureProgress ходят через глобальный db (не DI) — тот же приём мока модуля целиком,
// что grant-access.test.ts/resend-email.test.ts. getLesson мокаем, чтобы не тянуть реальный content/
// (тест проверяет ТОЛЬКО scoping запросов по courseSlug, не контент).
vi.mock('@/lib/db', () => ({
  db: {
    lessonProgress: { upsert: vi.fn() },
    quizResult: { findFirst: vi.fn(), create: vi.fn() },
  },
}))
vi.mock('@/lib/content', () => ({ getLesson: vi.fn(() => ({ meta: { id: '1.1' } })) }))

import { db } from '@/lib/db'
import { startAttempt } from './index'

// db.quizResult.findFirst/create типизированы по реальному PrismaClient — в тестах нужен только
// фейковый колбэк поверх мока (тот же приём сужения через any, что и db.$transaction/tx.* create
// в grant-access.test.ts/resend-email.test.ts).
const mockFindFirst = db.quizResult.findFirst as unknown as { mockImplementation: (fn: (args: { where: { courseSlug: string } }) => Promise<unknown>) => void }
const mockCreate = db.quizResult.create as unknown as { mockImplementation: (fn: (args: { data: Record<string, unknown> }) => Promise<unknown>) => void }

/** Ф7в T2 (MC-05, E-MC2): было `where: { userId, lessonId }` без courseSlug — max(attempt)
 *  читался бы через ВСЕ курсы студента разом, так что attempt-нумерация одного курса зависела
 *  от попыток другого (латентный баг-двойник дыры в @@unique QuizResult). Тест доказывает, что
 *  после фикса запрос курсо-скопирован: одинаковый (userId, lessonId) в двух курсах не мешает
 *  друг другу — каждый курс независимо считает свой max(attempt). */
describe('startAttempt — courseSlug-scoping (MC-05, E-MC2)', () => {
  const userId = 'u-1'

  beforeEach(() => {
    vi.mocked(db.lessonProgress.upsert).mockReset().mockResolvedValue({} as never)
    vi.mocked(db.quizResult.findFirst).mockReset()
    vi.mocked(db.quizResult.create).mockReset()
  })

  it('findFirst (поиск max attempt) вызывается с courseSlug в where — не глобально по userId/lessonId', async () => {
    vi.mocked(db.quizResult.findFirst).mockResolvedValue(null)
    mockCreate.mockImplementation(async ({ data }) => ({ id: 'qr-1', ...data }))

    await startAttempt(userId, 'ai-basics', '1.1')

    expect(db.quizResult.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId, courseSlug: 'ai-basics', lessonId: '1.1' } }),
    )
  })

  it('два курса с одинаковым lessonId — attempt-нумерация НЕ конфликтует (данные разных курсов не смешиваются)', async () => {
    // Симулируем реальную БД: у 'ai-basics' уже есть попытка attempt=1 на урок 1.1,
    // у 'demo-course' попыток ещё нет — findFirst должен вернуть разный результат по courseSlug.
    mockFindFirst.mockImplementation(async ({ where }) => (where.courseSlug === 'ai-basics' ? { attempt: 1 } : null))
    mockCreate.mockImplementation(async ({ data }) => ({ id: 'qr-x', ...data }))

    const aiBasicsAttempt = await startAttempt(userId, 'ai-basics', '1.1')
    const demoAttempt = await startAttempt(userId, 'demo-course', '1.1')

    // ai-basics: max=1 существующая попытка → новая attempt=2.
    expect(aiBasicsAttempt.attempt).toBe(2)
    // demo-course: своих попыток нет (существование попытки ai-basics не «перетекло») → attempt=1,
    // а НЕ 2/3 — это и есть доказательство отсутствия конфликта между курсами.
    expect(demoAttempt.attempt).toBe(1)

    expect(db.quizResult.create).toHaveBeenNthCalledWith(1, { data: expect.objectContaining({ courseSlug: 'ai-basics', lessonId: '1.1', attempt: 2 }) })
    expect(db.quizResult.create).toHaveBeenNthCalledWith(2, { data: expect.objectContaining({ courseSlug: 'demo-course', lessonId: '1.1', attempt: 1 }) })
  })
})
