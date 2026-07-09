import { db } from '@/lib/db'

export type GdprResult = 'deleted' | 'not_found' | 'email_mismatch'

/**
 * ADM-10/11: необратимое удаление студента и всех его данных по запросу GDPR.
 *
 * Сверка со списком docs/data-model.md «Судьба записей при GDPR-удалении» (перепроверять
 * при любом изменении prisma/schema.prisma):
 * - Enrollment, LessonProgress, QuizResult, DeferredQuizState, Submission, EmailLog, TrainerUsage —
 *   userId обязателен, onDelete: Cascade → падают сами при user.delete ниже, явных deleteMany не пишем.
 * - Consent — userId ОПЦИОНАЛЕН (согласие даётся ещё до создания User, см. lib/registration),
 *   onDelete: Cascade сработает только для строк, где userId уже проставлен grantAccess'ом;
 *   строки без userId каскад не увидит → удаляем явно deleteMany по email.
 * - Registration и PasswordResetToken (бывш. MagicLink) — вообще без FK на User (связь только по email) → каскад их не заденет
 *   в принципе, удаляем явно deleteMany по email.
 * - Certificate — userId опционален, onDelete: SetNull, но SetNull сам по себе оставил бы status:
 *   VALID с number/courseTitle и без ФИО — сертификат должен пережить удаление владельца именно как
 *   ОБЕЗЛИЧЕННЫЙ И ОТОЗВАННЫЙ артефакт (D-010, CERT-07-заготовка), поэтому обезличиваем и отзываем
 *   явно (userId/fullName → null, status → REVOKED, revokedAt) ДО user.delete, в той же транзакции.
 * - CertificateCounter — не участвует, номера сертификатов не переиспользуются (CERT-03).
 */
export async function gdprDeleteStudent(userId: string, confirmEmail: string): Promise<GdprResult> {
  const user = await db.user.findUnique({ where: { id: userId } })
  if (!user) return 'not_found'
  if (user.email !== confirmEmail.trim().toLowerCase()) return 'email_mismatch' // ADM-11: явное подтверждение email админом

  await db.$transaction(async tx => {
    await tx.certificate.updateMany({
      where: { userId },
      data: { userId: null, fullName: null, status: 'REVOKED', revokedAt: new Date() },
    })
    await tx.passwordResetToken.deleteMany({ where: { email: user.email } })
    await tx.consent.deleteMany({ where: { email: user.email } })
    await tx.registration.deleteMany({ where: { email: user.email } })
    await tx.user.delete({ where: { id: userId } }) // enrollment/progress/quiz/deferred/submission/emailLog/trainerUsage — onDelete: Cascade
  })
  return 'deleted'
}
