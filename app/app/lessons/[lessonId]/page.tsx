import { permanentRedirect } from 'next/navigation'

/** Ф7в T3 (MC-04/E-MC1): старый маршрут без courseSlug — 308 на курс ai-basics
 *  (первый и пока единственный курс на проде с закладками на этот URL). */
export default async function LegacyLessonRedirect({ params }: { params: Promise<{ lessonId: string }> }) {
  const { lessonId } = await params
  permanentRedirect(`/app/ai-basics/lessons/${lessonId}`)
}
