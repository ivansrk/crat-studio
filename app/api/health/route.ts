import { articleIssues, contentErrors, getContent } from '@/lib/content'

export const dynamic = 'force-dynamic'

export async function GET() {
  const errors = contentErrors()
  const body = {
    ok: errors.length === 0,
    lessons: getContent().lessons.size,
    errors: errors.map(e => `${e.lessonId ?? ''} ${e.message}`.trim()),
    // Информативно: битая статья НЕ роняет ok/статус-код — раздел статей
    // опционален (ART-03), а UptimeRobot мониторит именно курс по keyword «ok».
    articleErrors: articleIssues().filter(i => i.level === 'error').length,
  }
  return Response.json(body, { status: body.ok ? 200 : 500 })
}
