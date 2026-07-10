import { permanentRedirect } from 'next/navigation'

/** MC-04/E-MC1: старый маршрут без courseSlug — 308 на курс ai-basics,
 *  query (attempt/feedback) переносится как есть (ссылка на активную попытку в письме/закладке). */
export default async function LegacyQuizRedirect({ params, searchParams }: {
  params: Promise<{ lessonId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { lessonId } = await params
  const sp = new URLSearchParams()
  for (const [key, value] of Object.entries(await searchParams)) {
    if (Array.isArray(value)) value.forEach(v => sp.append(key, v))
    else if (value !== undefined) sp.set(key, value)
  }
  const qs = sp.toString()
  permanentRedirect(`/app/ai-basics/lessons/${lessonId}/quiz${qs ? `?${qs}` : ''}`)
}
