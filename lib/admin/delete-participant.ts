import { db } from '@/lib/db'
import { syncContactDelete } from '@/lib/resend-audience'
import { isAdminEmail } from '@/lib/auth/current-user'

export type DeleteParticipantResult = 'deleted' | 'not_found' | 'email_mismatch' | 'is_admin'

/** Ссылка на участника из любого раздела админки: студент/клиент (по userId) или заявка (по registrationId). */
export type DeleteParticipantRef = { userId: string } | { registrationId: string }

/** Затирка адреса в EmailLog при обезличивании (D-050): лог доставки остаётся как факт отправки,
 *  но без персональных данных. */
export const DELETED_EMAIL = '[удалён]'

/**
 * ADM-10/11/13, GDPR-01…03, D-050: ЕДИНСТВЕННАЯ доменная функция полного удаления участника.
 *
 * Вызывается из ЛЮБОГО раздела админки (заявки `/admin`, студенты `/admin/students`,
 * клиенты `/admin/clients` + карточки) и удаляет человека ВЕЗДЕ за один вызов — заявку, учётку,
 * прогресс, попытки, отложенные, мини-проекты, согласия, токены, сертификаты, рассылки.
 *
 * Судьба записей (сверять при любом изменении prisma/schema.prisma — пройтись по всему, что
 * ссылается на userId/registrationId/email):
 * - Enrollment, LessonProgress, QuizResult, DeferredQuizState, Submission, TrainerUsage —
 *   userId обязателен, onDelete: Cascade → падают сами при user.delete, явных deleteMany не пишем.
 * - Certificate — ФИЗИЧЕСКИ удаляем (D-050: право на удаление приоритетнее реестра выданных;
 *   после этого публичная проверка /cert/{номер} честно отвечает «не найден», app/cert/[number]).
 *   Меняет прежнее REVOKED-обезличивание (D-010/CERT-07). CertificateCounter не трогаем — номера
 *   не переиспользуются (CERT-03), новых коллизий нет.
 * - ConsultationRequest — обезличиваем (userId → null), сам лид (name/contact/message) остаётся у
 *   студии (D-048): деловое обращение переживает удаление учётной записи студента.
 * - EmailLog — обезличиваем (userId → null, toEmail → DELETED_EMAIL) ДО user.delete: если бы
 *   каскад (onDelete: Cascade) удалил строки, пропал бы журнал доставки. Обнулив userId заранее,
 *   выводим строки из-под каскада — они переживают удаление User уже без ПД (D-050).
 * - Consent, Registration, PasswordResetToken — без FK на User (связь по email) → каскад их не
 *   заденет, удаляем явно deleteMany по email (заявка/opt-in-токены/журнал согласий).
 *
 * Подтверждение (ADM-11): confirmEmail должен совпасть с email участника — та же защита, что и
 * на карточке студента, но теперь на всех точках вызова.
 */
export async function deleteParticipant(
  ref: DeleteParticipantRef,
  confirmEmail: string,
): Promise<DeleteParticipantResult> {
  // 1. Разрешаем email + (если есть) userId из ссылки любого типа.
  let email: string
  let user: Awaited<ReturnType<typeof db.user.findUnique>> = null
  if ('userId' in ref) {
    user = await db.user.findUnique({ where: { id: ref.userId } })
    if (!user) return 'not_found'
    email = user.email
  } else {
    const reg = await db.registration.findUnique({ where: { id: ref.registrationId } })
    if (!reg) return 'not_found'
    email = reg.email
    // Заявка могла уже стать учёткой (ENROLLED) — тот же email → удаляем и User вместе с ней.
    user = await db.user.findUnique({ where: { email } })
  }
  const userId = user?.id ?? null

  // Гейт: учётку/заявку админа (email в ADMIN_EMAILS) удалить нельзя ни из какого раздела.
  if (isAdminEmail(email)) return 'is_admin'
  if (email !== confirmEmail.trim().toLowerCase()) return 'email_mismatch' // ADM-11

  // Resend-синк удаления — ПЕРЕД транзакцией (right to erasure не блокируется сбоем Resend, CRM-05).
  if (user) {
    await syncContactDelete(user).catch(e =>
      console.error('[delete-participant] Resend-синк удаления не удался (CRM-05):', e),
    )
  }

  await db.$transaction(async tx => {
    if (userId) {
      await tx.certificate.deleteMany({ where: { userId } }) // D-050: физическое удаление
      await tx.consultationRequest.updateMany({ where: { userId }, data: { userId: null } }) // D-048: лид остаётся
      await tx.emailLog.updateMany({ where: { userId }, data: { userId: null, toEmail: DELETED_EMAIL } }) // до user.delete
    }
    await tx.passwordResetToken.deleteMany({ where: { email } })
    await tx.consent.deleteMany({ where: { email } })
    // Письма double opt-in уходят ДО создания User (userId: null) — обезличиваем их по адресу.
    await tx.emailLog.updateMany({ where: { toEmail: email }, data: { userId: null, toEmail: DELETED_EMAIL } })
    await tx.registration.deleteMany({ where: { email } })
    if (userId) await tx.user.delete({ where: { id: userId } }) // каскад: enrollment/progress/quiz/deferred/submission/trainerUsage
  })
  return 'deleted'
}
