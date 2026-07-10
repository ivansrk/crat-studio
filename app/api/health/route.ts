import { articleIssues, contentErrors, getCourses } from '@/lib/content'

export const dynamic = 'force-dynamic'

export async function GET() {
  const errors = contentErrors()
  const body = {
    ok: errors.length === 0,
    // MC-08: по всем курсам реестра, не только ai-basics.
    courses: Object.fromEntries(getCourses().map(c => [c.slug, { lessons: c.lessons.size, published: c.published }])),
    errors: errors.map(e => `${e.lessonId ?? ''} ${e.message}`.trim()),
    // Информативно: битая статья НЕ роняет ok/статус-код — раздел статей
    // опционален (ART-03), а UptimeRobot мониторит именно курс по keyword «ok».
    articleErrors: articleIssues().filter(i => i.level === 'error').length,
  }
  return Response.json(body, { status: body.ok ? 200 : 500 })
}
