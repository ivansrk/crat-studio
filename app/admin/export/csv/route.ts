import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { currentUser, isAdminEmail } from '@/lib/auth/current-user'
import { buildNewsletterCsv } from '@/lib/admin/newsletter-csv'

export const dynamic = 'force-dynamic'

/** ADM-09: CSV контактов с действующим согласием на рассылку. Не-админу — 404 (как в admin/layout). */
export async function GET() {
  const user = await currentUser()
  if (!user || !isAdminEmail(user.email)) notFound()
  const [contacts, consents] = await Promise.all([
    db.registration.findMany({ select: { email: true, firstName: true, lastName: true, phone: true, telegram: true } }),
    db.consent.findMany({ where: { type: 'NEWSLETTER' }, select: { email: true, granted: true, createdAt: true } }),
  ])
  const csv = buildNewsletterCsv(contacts, consents)
  return new Response('﻿' + csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="newsletter.csv"',
    },
  })
}
