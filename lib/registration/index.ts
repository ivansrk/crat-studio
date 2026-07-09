import { db } from '@/lib/db'
import { appendConsent } from './consents'
import { isUniqueViolation } from '@/lib/db-errors'

export type RegistrationInput = {
  firstName: string; lastName: string; email: string
  phone: string | null; telegram: string | null
  dataConsent: boolean; newsletterConsent: boolean
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Возвращает нормализованные данные или null, если форма невалидна (REG-02, REG-06, REG-08). */
export function normalizeRegistration(i: RegistrationInput): RegistrationInput | null {
  const email = i.email?.trim().toLowerCase() ?? ''
  const firstName = i.firstName?.trim() ?? ''
  const lastName = i.lastName?.trim() ?? ''
  if (!firstName || !lastName || !EMAIL_RE.test(email) || !i.dataConsent) return null
  const opt = (v: string | null) => (v?.trim() ? v.trim() : null)
  return { firstName, lastName, email, phone: opt(i.phone), telegram: opt(i.telegram), dataConsent: true, newsletterConsent: !!i.newsletterConsent }
}

/** F1: создаёт/обновляет заявку + пишет согласия. Возвращает 'accepted' всегда (экран один и тот же). */
export async function submitRegistration(input: RegistrationInput): Promise<'accepted' | 'invalid'> {
  const data = normalizeRegistration(input)
  if (!data) return 'invalid'
  const { email, firstName, lastName, phone, telegram } = data

  // Заявка + оба согласия — атомарно, одной транзакцией.
  const persist = () => db.$transaction(async tx => {
    const existingUser = await tx.user.findUnique({ where: { email } })          // REG-09
    const existing = await tx.registration.findUnique({ where: { email } })
    if (existing) {
      await tx.registration.update({                                            // REG-05: не дубль, а update
        where: { email },
        data: { firstName, lastName, phone, telegram, submitCount: { increment: 1 }, alreadyEnrolled: !!existingUser,
                status: existing.status === 'ENROLLED' ? 'ENROLLED' : 'RESUBMITTED' },
      })
    } else {
      await tx.registration.create({ data: { email, firstName, lastName, phone, telegram, alreadyEnrolled: !!existingUser } })
    }
    await appendConsent({ email, type: 'DATA_PROCESSING', granted: true, source: 'REGISTRATION_FORM', userId: existingUser?.id }, tx)
    await appendConsent({ email, type: 'NEWSLETTER', granted: data.newsletterConsent, source: 'REGISTRATION_FORM', userId: existingUser?.id }, tx)
  })

  try {
    await persist()
  } catch (e) {
    // Двойной сабмит (double-click): оба запроса видят findUnique=null → второй create падает P2002 →
    // повторяем транзакцию, заявка уже существует → update-ветка. Оба запроса получают 'accepted'.
    if (!isUniqueViolation(e)) throw e
    try {
      await persist()
    } catch (e2) {
      // Теоретический второй P2002 подряд: данные первой гонки уже в базе, пользователю чинить нечего — accepted.
      if (!isUniqueViolation(e2)) throw e2
    }
  }
  return 'accepted'
}
