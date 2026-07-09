import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { currentUser } from '@/lib/auth/current-user'
import { renderCertificatePdf } from '@/lib/cert/pdf'
import { formatDate } from '@/lib/i18n/format-date'

export const dynamic = 'force-dynamic'

/** D-011: PDF не хранится — рендерится Playwright'ом на каждое скачивание. Только свой VALID-сертификат. */
export async function GET() {
  const user = await currentUser()
  if (!user) notFound()
  const cert = await db.certificate.findFirst({ where: { userId: user.id, courseSlug: 'ai-basics', status: 'VALID' } })
  if (!cert || !cert.fullName) notFound()

  const pdf = await renderCertificatePdf({
    fullName: cert.fullName, courseTitle: cert.courseTitle, number: cert.number, dateStr: formatDate(cert.issuedAt),
  })
  return new Response(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${cert.number}.pdf"`,
      'Cache-Control': 'no-store', // D-011: не кэшировать — рендер на каждое скачивание
    },
  })
}
