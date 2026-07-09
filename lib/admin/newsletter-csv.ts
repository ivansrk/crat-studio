import { latestConsentByEmail } from '@/lib/registration/consents'

type Contact = { email: string; firstName: string; lastName: string; phone: string | null; telegram: string | null }
type ConsentRow = { email: string; granted: boolean; createdAt: Date }

const esc = (v: string | null) => {
  const s = v ?? ''
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** ADM-09: только контакты с действующим согласием NEWSLETTER (последняя запись granted=true). */
export function buildNewsletterCsv(contacts: Contact[], newsletterConsents: ConsentRow[]): string {
  const latest = latestConsentByEmail(newsletterConsents)
  const lastDate = new Map<string, Date>()
  for (const c of newsletterConsents) {
    const prev = lastDate.get(c.email)
    if (!prev || c.createdAt > prev) lastDate.set(c.email, c.createdAt)
  }
  const rows = contacts.filter(c => latest.get(c.email) === true)
    .map(c => [esc(c.firstName), esc(c.lastName), esc(c.email), esc(c.phone), esc(c.telegram), lastDate.get(c.email)!.toISOString()].join(','))
  return ['firstName,lastName,email,phone,telegram,consentDate', ...rows].join('\n')
}
