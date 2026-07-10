import { db } from '@/lib/db'
import { isUniqueViolation } from '@/lib/db-errors'
import { PROJECT_FIELDS, normalizeDraft, isSubmittable, type ProjectDraft } from './fields'
import type { Submission } from '@/lib/generated/prisma/client'

/** Текущая попытка мини-проекта = max(attempt) (D-016: пересдача — новая строка). */
export async function getCurrentSubmission(userId: string, courseSlug: string): Promise<Submission | null> {
  return db.submission.findFirst({ where: { userId, courseSlug }, orderBy: { attempt: 'desc' } })
}

type ProjectField = (typeof PROJECT_FIELDS)[number]

const draftFields = (s: Pick<Submission, ProjectField>): ProjectDraft =>
  Object.fromEntries(PROJECT_FIELDS.map(f => [f, s[f]])) as ProjectDraft

export type SaveDraftResult = 'saved' | 'locked'

/** PROJ-02/03/04/06: черновик = строка DRAFT.
 *  APPROVED/SUBMITTED — на проверке/принято, не редактируем (PROJ-03/06) → 'locked'.
 *  NEEDS_CHANGES — первое редактирование после правок открывает НОВУЮ попытку
 *  (attempt+1, DRAFT, предзаполнена текущими полями, поверх — applied draft; D-016: старая строка не меняется).
 *  DRAFT — update на месте. Нет попытки — create attempt 1.
 *  P2002-ретрай на гонку attempt (паттерн startAttempt из lib/progress).
 *  Контракт: ожидает все 7 ключей на каждый вызов (одна полная форма) —
 *  частичный объект обнулит непереданные поля (normalizeDraft: отсутствующее → null). */
export async function saveDraft(userId: string, courseSlug: string, draft: Record<string, unknown>): Promise<SaveDraftResult> {
  const normalized = normalizeDraft(draft)
  for (let tryN = 0; tryN < 2; tryN++) {
    const current = await getCurrentSubmission(userId, courseSlug)
    if (current?.status === 'APPROVED' || current?.status === 'SUBMITTED') return 'locked'

    try {
      if (current?.status === 'NEEDS_CHANGES') {
        await db.submission.create({
          // ...draftFields(current) при полном draft перекрывается normalized целиком —
          // страховка на случай частичного draft от будущего вызывающего (предзаполнение прошлой попыткой, PROJ-04).
          data: { userId, courseSlug, attempt: current.attempt + 1, status: 'DRAFT', ...draftFields(current), ...normalized },
        })
      } else if (current) {
        // DRAFT. Status-guard против TOCTOU: submitProject из второй вкладки мог успеть
        // flip'нуть DRAFT→SUBMITTED — редактировать отправленный отчёт нельзя (PROJ-03/06).
        const updated = await db.submission.updateMany({ where: { id: current.id, status: 'DRAFT' }, data: normalized })
        if (updated.count !== 1) return 'locked'
      } else {
        await db.submission.create({ data: { userId, courseSlug, attempt: 1, status: 'DRAFT', ...normalized } })
      }
      return 'saved'
    } catch (e) {
      if (!isUniqueViolation(e) || tryN === 1) throw e // гонка двух вкладок на attempt — перечитываем max и пробуем ещё раз
    }
  }
  throw new Error('unreachable')
}

export type SubmitResult = 'submitted' | 'incomplete' | 'locked'

/** PROJ-01/03: отправка — только из DRAFT и только когда все 7 полей заполнены. */
export async function submitProject(userId: string, courseSlug: string): Promise<SubmitResult> {
  const current = await getCurrentSubmission(userId, courseSlug)
  if (current?.status !== 'DRAFT') return 'locked'
  if (!isSubmittable(draftFields(current))) return 'incomplete'
  // Status-guard против TOCTOU (двойной submit из двух вкладок): переводим только из DRAFT.
  const updated = await db.submission.updateMany({
    where: { id: current.id, status: 'DRAFT' },
    data: { status: 'SUBMITTED', submittedAt: new Date() },
  })
  if (updated.count !== 1) return 'locked'
  return 'submitted'
}

// ВАЖНО-инвариант: после APPROVED попытки здесь больше не создаются (saveDraft/submitProject
// на APPROVED всегда возвращают 'locked') — на этом стоит isEligible в lib/cert (T3):
// `current?.status === 'APPROVED'` в isEligible всегда означает «текущая и единственно
// возможная финальная» попытка, никакая новая попытка не может «отменить» approve.
