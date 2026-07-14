import { describe, it, expect, vi, beforeEach } from 'vitest'

// isEligible ходит через глобальный db (getCourseProgress → lib/db) — тот же приём мока модуля
// целиком, что и в других *.test.ts рядом (grant-access/resend-email). lib/content НЕ мокаем —
// demo-course/ai-basics читаются из реального content/ (E-MC2/MC-06 доказывается на настоящем
// демо-курсе с lessonCount=1, а не на подставном числе).
vi.mock('@/lib/db', () => ({
  db: {
    lessonProgress: { findMany: vi.fn() },
    submission: { findFirst: vi.fn() },
  },
}))

import { db } from '@/lib/db'
import { isEligible } from './index'

const now = new Date('2026-07-10T12:00:00Z')
const passedRow = (lessonId: string) => ({ lessonId, quizPassedAt: now, practiceDoneAt: now })

describe('isEligible — MC-06 (знаменатель per-course, не хардкод 12)', () => {
  beforeEach(() => {
    vi.mocked(db.lessonProgress.findMany).mockReset()
    vi.mocked(db.submission.findFirst).mockReset()
  })

  it('demo-course (lessonCount=1): 1/1 пройден + APPROVED → eligible', async () => {
    vi.mocked(db.lessonProgress.findMany).mockResolvedValue([passedRow('1.1')] as never)
    vi.mocked(db.submission.findFirst).mockResolvedValue({ status: 'APPROVED' } as never)

    await expect(isEligible('u-1', 'demo-course')).resolves.toBe(true)
  })

  it('demo-course: 1/1 пройден, но проект НЕ approved → not eligible', async () => {
    vi.mocked(db.lessonProgress.findMany).mockResolvedValue([passedRow('1.1')] as never)
    vi.mocked(db.submission.findFirst).mockResolvedValue({ status: 'SUBMITTED' } as never)

    await expect(isEligible('u-1', 'demo-course')).resolves.toBe(false)
  })

  it('тот же ровно-1-пройденный-урок для ai-basics (lessonCount=12) → not eligible — знаменатель не общий', async () => {
    // Тот же byLesson-набор, что делает demo-course студента eligible, для ai-basics эквивалентен 1/12.
    vi.mocked(db.lessonProgress.findMany).mockResolvedValue([passedRow('1.1')] as never)
    vi.mocked(db.submission.findFirst).mockResolvedValue({ status: 'APPROVED' } as never)

    await expect(isEligible('u-1', 'ai-basics')).resolves.toBe(false)
  })

  it('ai-basics: все 12 пройдены + APPROVED → eligible (регресс — старое поведение не сломано)', async () => {
    const rows = ['1.1', '1.2', '1.3', '1.4', '2.1', '2.2', '2.3', '3.1', '3.2', '3.3', '4.1', '4.2'].map(passedRow)
    vi.mocked(db.lessonProgress.findMany).mockResolvedValue(rows as never)
    vi.mocked(db.submission.findFirst).mockResolvedValue({ status: 'APPROVED' } as never)

    await expect(isEligible('u-1', 'ai-basics')).resolves.toBe(true)
  })
})
