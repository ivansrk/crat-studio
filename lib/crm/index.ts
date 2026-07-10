import { db } from '@/lib/db'
import { normalizePhone } from '@/lib/registration/phone'
import { getEffectiveConsent, isEffectivelyGranted } from '@/lib/consent/effective'
import { syncContactSubscribe, syncContactUnsubscribe } from '@/lib/resend-audience'
import { parseAdminEmails } from '@/lib/auth/parse-admin-emails'
import type { Certificate, Consent, ConsultationRequest, Enrollment, PrismaClient, Registration, User } from '@/lib/generated/prisma/client'

// F16/CRM-01…03: клиентская база в админке. Три операции — список с поиском, карточка-история,
// редактирование — плюс пересинхронизация Resend по действующему согласию (CRM-05).

type CrmDbClient = Pick<PrismaClient, 'user' | 'consent' | 'registration' | 'enrollment' | 'certificate' | 'consultationRequest'>

export type ClientListItem = {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string | null
  telegram: string | null
  whatsapp: string | null
  subscribed: boolean // действующее согласие NEWSLETTER (D-014)
  lastCourseSlug: string | null // последний Enrollment по createdAt (CRM-01)
  resendSyncError: boolean // CRM-05: баннер рассинхрона
}

/** CRM-01/02: все клиенты + последний курс + действующая подписка, с поиском по подстроке
 *  (имя/фамилия/email/телефон, регистронезависимо). N+1-безопасно: последний Enrollment и
 *  последний NEWSLETTER-Consent тянутся как коррелированные подзапросы (orderBy+take на
 *  relation) в том же findMany, а не отдельным запросом на каждого пользователя. */
export async function listClients(query?: string, client: CrmDbClient = db): Promise<ClientListItem[]> {
  const q = (query ?? '').trim()
  const searchWhere = q
    ? {
        OR: [
          { firstName: { contains: q, mode: 'insensitive' as const } },
          { lastName: { contains: q, mode: 'insensitive' as const } },
          { email: { contains: q, mode: 'insensitive' as const } },
          { phone: { contains: q, mode: 'insensitive' as const } },
        ],
      }
    : {}
  // T8 дизайн-аудита (П2): админы — не клиенты, в базу CRM не попадают (см. app/admin/students/page.tsx,
  // тот же приём). Ключ добавляем только при непустом списке — не меняет форму where для проектов
  // без ADMIN_EMAILS (в т.ч. существующих тестов).
  const adminEmails = parseAdminEmails(process.env.ADMIN_EMAILS)
  const where = adminEmails.length > 0 ? { ...searchWhere, email: { notIn: adminEmails } } : searchWhere

  const users = await client.user.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      enrollments: { orderBy: { createdAt: 'desc' as const }, take: 1 },
      consents: { where: { type: 'NEWSLETTER' as const }, orderBy: { createdAt: 'desc' as const }, take: 1 },
    },
  })

  return users.map(u => ({
    id: u.id,
    firstName: u.firstName,
    lastName: u.lastName,
    email: u.email,
    phone: u.phone,
    telegram: u.telegram,
    whatsapp: u.whatsapp,
    subscribed: u.consents[0]?.granted ?? false,
    lastCourseSlug: u.enrollments[0]?.courseSlug ?? null,
    resendSyncError: u.resendSyncError != null,
  }))
}

export type ClientDetail = {
  user: User
  registration: Registration | null // заявка по email — может не быть (легаси-юзер без Registration)
  consents: Consent[] // весь журнал по email, новые сверху (D-014)
  enrollments: Enrollment[]
  certificate: Certificate | null
  consultations: ConsultationRequest[] // T8 дизайн-аудита (П3): заявки на консультацию этого клиента
  subscribed: boolean // действующее согласие NEWSLETTER, свёрнутое из consents
}

/** CRM-03: полный профиль + история для карточки клиента. null, если такого User нет. */
export async function getClient(userId: string, client: CrmDbClient = db): Promise<ClientDetail | null> {
  const user = await client.user.findUnique({ where: { id: userId } })
  if (!user) return null

  const [registration, consents, enrollments, certificate, consultations] = await Promise.all([
    client.registration.findUnique({ where: { email: user.email } }),
    client.consent.findMany({ where: { email: user.email }, orderBy: { createdAt: 'desc' } }),
    client.enrollment.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }),
    client.certificate.findFirst({ where: { userId, status: { in: ['VALID', 'REVOKED'] } }, orderBy: { issuedAt: 'desc' } }),
    client.consultationRequest.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }),
  ])

  // D-014: действующее = последняя запись по createdAt — та же свёртка, что у CSV-экспорта и
  // resync (lib/consent/effective), просто над уже загруженным журналом, без похода в базу.
  const subscribed = isEffectivelyGranted(consents.filter(c => c.type === 'NEWSLETTER'))

  return { user, registration, consents, enrollments, certificate, consultations, subscribed }
}

export type UpdateClientInput = {
  firstName: string
  lastName: string
  phone: string | null
  telegram: string | null
  whatsapp: string | null
}

export type UpdateClientResult =
  | { status: 'ok'; user: User }
  | { status: 'invalid'; field: 'firstName' | 'lastName' | 'phone' }
  | { status: 'not_found' }

/** CRM-02/03: редактирование карточки — email НЕ трогается (read-only, якорь журналов согласий).
 *  Пустой телефон допустим (легаси-юзеры без телефона, созданные до Ф7б); непустой ввод либо
 *  нормализуется в валидный, либо отклоняется — «мусор» в базу не пишем. */
export async function updateClient(userId: string, input: UpdateClientInput, client: CrmDbClient = db): Promise<UpdateClientResult> {
  const firstName = input.firstName.trim()
  const lastName = input.lastName.trim()
  if (!firstName) return { status: 'invalid', field: 'firstName' }
  if (!lastName) return { status: 'invalid', field: 'lastName' }

  const phoneRaw = (input.phone ?? '').trim()
  let phone: string | null = null
  if (phoneRaw) {
    phone = normalizePhone(phoneRaw)
    if (!phone) return { status: 'invalid', field: 'phone' }
  }

  const telegram = (input.telegram ?? '').trim() || null
  const whatsapp = (input.whatsapp ?? '').trim() || null

  try {
    const user = await client.user.update({ where: { id: userId }, data: { firstName, lastName, phone, telegram, whatsapp } })
    return { status: 'ok', user }
  } catch {
    return { status: 'not_found' }
  }
}

export type ResyncResult = 'synced' | 'skipped' | 'error' | 'not_found'

/** CRM-05: ручная пересинхронизация из карточки клиента — по действующей NEWSLETTER-подписке
 *  выбирает subscribe (есть согласие) или unsubscribe (согласия нет/отозвано), а не жёстко одно
 *  направление — карточка могла рассинхрониться в любую сторону. */
export async function resyncClient(userId: string, client: CrmDbClient = db): Promise<ResyncResult> {
  const user = await client.user.findUnique({ where: { id: userId } })
  if (!user) return 'not_found'

  const subscribed = await getEffectiveConsent(user.email, 'NEWSLETTER', client)
  try {
    return subscribed ? await syncContactSubscribe(user, client) : await syncContactUnsubscribe(user, client)
  } catch {
    return 'error'
  }
}
