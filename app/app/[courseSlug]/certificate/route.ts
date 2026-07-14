import { notFound } from 'next/navigation'
import { getCourse } from '@/lib/content'
import { db } from '@/lib/db'
import { currentUser } from '@/lib/auth/current-user'
import { renderCertificatePdf } from '@/lib/cert/pdf'
import { resolveCertPeriodStr } from '@/lib/cert'
import { buildProgramHtml } from '@/lib/cert/program'

export const dynamic = 'force-dynamic'

/** /app/{courseSlug}/certificate — перенос app/app/certificate/route.ts
 *  с параметризацией (MC-04). D-011: PDF не хранится — рендерится Playwright'ом на каждое
 *  скачивание. Только свой VALID-сертификат этого курса. */
export async function GET(_request: Request, { params }: { params: Promise<{ courseSlug: string }> }) {
  const { courseSlug } = await params
  const entry = getCourse(courseSlug)
  if (!entry || !entry.published) notFound() // MC-01/02

  const user = await currentUser()
  if (!user) notFound()
  const cert = await db.certificate.findFirst({ where: { userId: user.id, courseSlug, status: 'VALID' } })
  if (!cert || !cert.fullName) notFound()

  const pdf = await renderCertificatePdf({
    fullName: cert.fullName,
    courseTitle: cert.courseTitle,
    number: cert.number,
    hours: entry.hours, // CERT-09
    periodStr: await resolveCertPeriodStr(user.id, courseSlug, cert.issuedAt), // CERT-08
    programHtml: buildProgramHtml(courseSlug),
  })
  return new Response(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${cert.number}.pdf"`,
      'Cache-Control': 'no-store', // D-011: не кэшировать — рендер на каждое скачивание
    },
  })
}
