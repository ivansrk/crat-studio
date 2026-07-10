import { db } from '@/lib/db'

export type ReviewResult =
  | 'approved'         // принят, сертификат НЕ выдан сейчас (уроки ещё не все закрыты / уже выдан ранее)
  | 'approved_issued'  // принят и сертификат выдан+отправлен этим же действием (CERT-01 триггер №2)
  | 'needs_changes'
  | 'conflict'         // ADM-07: updatedAt разошёлся — кто-то другой уже отревьюил/студент отредактировал
  | 'not_found'
  | 'comment_required' // ADM-06: needs_changes без комментария студенту непонятен
  | 'not_submitted'    // повторный сабмит формы / гонка — уже не SUBMITTED

/** ADM-06/07: проверка мини-проекта админом. Optimistic concurrency — seenUpdatedAt из формы
 *  сравнивается атомарным updateMany (а не read-then-write), поэтому конфликт не может
 *  тихо перезаписать чужое решение (двух админов, либо студента, открывшего новую попытку). */
export async function reviewProject(
  submissionId: string,
  verdict: 'approve' | 'needs_changes',
  comment: string,
  seenUpdatedAt: string,
  adminId: string,
): Promise<ReviewResult> {
  const sub = await db.submission.findUnique({ where: { id: submissionId } })
  if (!sub) return 'not_found'
  if (sub.status !== 'SUBMITTED') return 'not_submitted'
  if (verdict === 'needs_changes' && !comment.trim()) return 'comment_required' // ADM-06

  const updated = await db.submission.updateMany({
    where: { id: submissionId, status: 'SUBMITTED', updatedAt: new Date(seenUpdatedAt) }, // ADM-07
    data: {
      status: verdict === 'approve' ? 'APPROVED' : 'NEEDS_CHANGES',
      adminComment: comment.trim() || null,
      reviewedById: adminId,
      reviewedAt: new Date(),
    },
  })
  if (updated.count !== 1) return 'conflict'

  if (verdict === 'approve') {
    // Динамический импорт — не создаём статический цикл (тот же приём, что recomputeCompletion → lib/cert).
    const { checkAndIssueCertificate } = await import('@/lib/cert') // триггер CERT-01 №2 (PROJ-05)
    // MC-05: courseSlug берётся из самой Submission (данные, не хардкод) — проект уже courseSlug-aware.
    const certResult = await checkAndIssueCertificate(sub.userId, sub.courseSlug).catch(e => {
      console.error('[cert] выдача после approve:', e)
      return 'not_eligible' as const
    })
    return certResult === 'issued' ? 'approved_issued' : 'approved'
  }
  return 'needs_changes'
}
