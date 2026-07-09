import { db } from '@/lib/db'
import { appendConsent } from './consents'

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

  const existingUser = await db.user.findUnique({ where: { email } })          // REG-09
  const existing = await db.registration.findUnique({ where: { email } })
  if (existing) {
    await db.registration.update({                                            // REG-05: не дубль, а update
      where: { email },
      data: { firstName, lastName, phone, telegram, submitCount: { increment: 1 }, alreadyEnrolled: !!existingUser,
              status: existing.status === 'ENROLLED' ? 'ENROLLED' : 'RESUBMITTED' },
    })
  } else {
    await db.registration.create({ data: { email, firstName, lastName, phone, telegram, alreadyEnrolled: !!existingUser } })
  }
  await appendConsent({ email, type: 'DATA_PROCESSING', granted: true, source: 'REGISTRATION_FORM', userId: existingUser?.id })
  await appendConsent({ email, type: 'NEWSLETTER', granted: data.newsletterConsent, source: 'REGISTRATION_FORM', userId: existingUser?.id })
  return 'accepted'
}
