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
  if (!name || !contact || !message || message.length > MESSAGE_MAX_LENGTH) return 'invalid'

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

export type UpdateConsultationStatusResult = 'ok' | 'not_found'

/** CONS-04: переключение статуса админом. */
export async function updateConsultationStatus(
  id: string,
  status: ConsultationStatus,
  client: ConsultationDbClient = db,
): Promise<UpdateConsultationStatusResult> {
  try {
    await client.consultationRequest.update({ where: { id }, data: { status } })
    return 'ok'
  } catch {
    return 'not_found'
  }
}
