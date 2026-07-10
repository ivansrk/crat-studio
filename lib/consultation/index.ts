import { db } from '@/lib/db'
import { limiters } from '@/lib/auth/rate-limit'
import { parseAdminEmails } from '@/lib/auth/parse-admin-emails'
import { sendEmail } from '@/lib/email'
import { renderConsultationEmail } from '@/lib/email/templates'
import { t } from '@/lib/i18n'
import type { ConsultationRequest, ConsultationStatus, PrismaClient } from '@/lib/generated/prisma/client'

// Ф7б Task 8, CONS-01…06: заявки на консультацию по внедрению ИИ — публичная форма (/consult)
// и блок в кабинете (MC-03), список со статусами в админке (/admin/consultations).

type ConsultationDbClient = Pick<PrismaClient, 'consultationRequest'>

const MESSAGE_MAX_LENGTH = 2000

export type ConsultationInput = {
  name: string
  contact: string // email/телефон/мессенджер — свободный текст (CONS-01)
  message: string
  topic?: string | null // направление (опц.) — значение из ru.ts consult.topicOptions
  dataConsent?: boolean // M3 (ревью Ф7в, LEGAL-05): обязательная галка согласия — без неё invalid
}

export type CreateConsultationResult = 'accepted' | 'rate' | 'invalid'

/** CONS-02/03/05: rate-limit 5/час/IP → валидация → создание NEW → письмо CONSULTATION
 *  на КАЖДЫЙ адрес из ADMIN_EMAILS (sendEmail шлёт одному адресату — цикл по списку,
 *  как syncAdmins). userId — если заявка из кабинета/с сессией (CONS-02), иначе null. */
export async function createConsultation(
  input: ConsultationInput,
  userId: string | null,
  ip: string,
  client: ConsultationDbClient = db,
): Promise<CreateConsultationResult> {
  if (!limiters.consultIp.allow(`cons:${ip}`)) return 'rate' // CONS-05, E-CONS1

  const name = input.name?.trim() ?? ''
  const contact = input.contact?.trim() ?? ''
  const message = input.message?.trim() ?? ''
  const topic = input.topic?.trim() || null
  // M3 (ревью Ф7в, LEGAL-05): заявка без обязательной галки согласия — invalid, как отсутствующее
  // обязательное поле; Consent-журнал не пишем (это не подписка на рассылку, D-037 остаётся про неё).
  if (!name || !contact || !message || message.length > MESSAGE_MAX_LENGTH || !input.dataConsent) return 'invalid'

  const source = userId ? 'cabinet' : 'public' // MC-03/CONS-01: одна форма /consult, вход из кабинета или публично
  await client.consultationRequest.create({
    data: { name, contact, message, topic, userId, source },
  })

  const admins = parseAdminEmails(process.env.ADMIN_EMAILS)
  await Promise.all(admins.map(email => sendEmail({
    to: email, userId: null, type: 'CONSULTATION',
    subject: t.email.consultationSubject,
    html: renderConsultationEmail({ name, contact, topic, message }),
    payload: {}, // D-028-аналог: данные заявки и так лежат в ConsultationRequest, лог не дублирует
  })))

  return 'accepted'
}

// NEW → CONTACTED → CLOSED (CONS-04): порядок групп в списке.
const STATUS_ORDER: readonly ConsultationStatus[] = ['NEW', 'CONTACTED', 'CLOSED']

/** CONS-04: список для /admin/consultations — статусом (NEW сверху), внутри группы новые первыми.
 *  Array.prototype.sort стабилен (ES2019) — порядок createdAt из orderBy сохраняется внутри группы. */
export async function listConsultations(client: ConsultationDbClient = db): Promise<ConsultationRequest[]> {
  const rows = await client.consultationRequest.findMany({ orderBy: { createdAt: 'desc' } })
  return [...rows].sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status))
}

export type UpdateConsultationStatusResult = 'ok' | 'not_found' | 'invalid_transition'

// m-1 (ревью Ф7б): раньше update() принимал любой статус напрямую — прямой POST мог откатить
// CLOSED → NEW. Разрешены только вперёд по порядку CONS-04 (NEW → CONTACTED → CLOSED), включая
// «перепрыжку» NEW → CLOSED; назад и повторно текущий статус — invalid_transition.
const ALLOWED_TRANSITIONS: Readonly<Record<ConsultationStatus, readonly ConsultationStatus[]>> = {
  NEW: ['CONTACTED', 'CLOSED'],
  CONTACTED: ['CLOSED'],
  CLOSED: [],
}

/** CONS-04: переключение статуса админом — только допустимые переходы вперёд (см. ALLOWED_TRANSITIONS). */
export async function updateConsultationStatus(
  id: string,
  status: ConsultationStatus,
  client: ConsultationDbClient = db,
): Promise<UpdateConsultationStatusResult> {
  const row = await client.consultationRequest.findUnique({ where: { id } })
  if (!row) return 'not_found'
  if (!ALLOWED_TRANSITIONS[row.status].includes(status)) return 'invalid_transition'

  await client.consultationRequest.update({ where: { id }, data: { status } })
  return 'ok'
}
