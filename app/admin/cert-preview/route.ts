import { notFound } from 'next/navigation'
import { currentUser, isAdminEmail } from '@/lib/auth/current-user'
import { renderCertificatePdf } from '@/lib/cert/pdf'
import { getCourse } from '@/lib/content'
import { buildPeriodStr, buildProgramHtml } from '@/lib/cert/program'

export const dynamic = 'force-dynamic'

/** /admin/cert-preview — предпросмотр шаблона сертификата с фиктивными данными
 *  (запрос Ивана 2026-07-14): приёмка дизайна шаблона + одно-кликовая проверка
 *  Playwright-генерации PDF на Render без выдачи реального сертификата.
 *  route.ts вне admin/layout-гейта (route handler) — поэтому свой ADM-01-гейт.
 *  D-044: фиктивный студент без Enrollment — период считается от «сегодня» (нет реальной
 *  даты зачисления, чем предпросмотр отличается от resolveCertPeriodStr боевых роутов). */
export async function GET() {
  const user = await currentUser()
  if (!user || !isAdminEmail(user.email)) notFound() // ADM-01

  // Локально роут отдаёт валидный PDF (проверено). Жалоба «не вижу шаблон при нажатии» — с прода,
  // где вероятная причина — падение Playwright/Chromium-рендера (renderCertificatePdf запускает
  // headless Chromium; на Render он может быть недоступен/упасть по памяти/таймауту). Без try/catch
  // такое падение отдаёт пустой экран/500 без объяснения. Ловим, ЛОГИРУЕМ (видно в Render-логах) и
  // отдаём человекочитаемый text/plain 500 — админ понимает, что сломалось, а не смотрит в пустоту.
  try {
    const course = getCourse('ai-basics')
    const pdf = await renderCertificatePdf({
      fullName: 'Иванова Мария Сергеевна',
      courseTitle: course?.course.title ?? 'Искусственный интеллект в профессиональной и личной деятельности',
      number: 'CRAT-2026-0000',
      hours: course?.hours ?? 72,
      periodStr: buildPeriodStr(new Date()),
      programHtml: buildProgramHtml('ai-basics'),
    })
    return new Response(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="cert-preview.pdf"',
        'Cache-Control': 'no-store',
      },
    })
  } catch (e) {
    console.error('[cert-preview] генерация PDF шаблона не удалась:', e)
    const detail = e instanceof Error ? e.message : String(e)
    return new Response(
      `Не удалось сгенерировать предпросмотр сертификата.\n\n` +
        `Вероятная причина: сбой рендера PDF (Playwright/Chromium) на сервере.\n` +
        `Техническая деталь (для логов): ${detail}\n`,
      { status: 500, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } },
    )
  }
}
