import { contentErrors, getContent } from '@/lib/content'

export const dynamic = 'force-dynamic'

export async function GET() {
  const errors = contentErrors()
  const body = {
    ok: errors.length === 0,
    lessons: getContent().lessons.size,
    errors: errors.map(e => `${e.lessonId ?? ''} ${e.message}`.trim()),
  }
  return Response.json(body, { status: body.ok ? 200 : 500 })
}
