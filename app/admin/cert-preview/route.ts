import { notFound } from 'next/navigation'
import { currentUser, isAdminEmail } from '@/lib/auth/current-user'
import { renderCertificatePdf } from '@/lib/cert/pdf'
import { getCourse } from '@/lib/content'
import { formatDate } from '@/lib/i18n/format-date'

export const dynamic = 'force-dynamic'

/** /admin/cert-preview — предпросмотр шаблона сертификата с фиктивными данными
 *  (запрос Ивана 2026-07-14): приёмка дизайна шаблона + одно-кликовая проверка
 *  Playwright-генерации PDF на Render без выдачи реального сертификата.
 *  route.ts вне admin/layout-гейта (route handler) — поэтому свой ADM-01-гейт. */
export async function GET() {
  const user = await currentUser()
  if (!user || !isAdminEmail(user.email)) notFound() // ADM-01

  const course = getCourse('ai-basics')
  const pdf = await renderCertificatePdf({
    fullName: 'Иванова Мария Сергеевна',
    courseTitle: course?.course.title ?? 'Искусственный интеллект в профессиональной и личной деятельности',
    number: 'CRAT-2026-0000',
    dateStr: formatDate(new Date()),
  })
  return new Response(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="cert-preview.pdf"',
      'Cache-Control': 'no-store',
    },
  })
}
