import { permanentRedirect } from 'next/navigation'

/** MC-04/E-MC1: старый маршрут без courseSlug — 308 на курс ai-basics,
 *  query (?project=saved|submitted|incomplete|locked) переносится как есть. */
export default async function LegacyProjectRedirect({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = new URLSearchParams()
  for (const [key, value] of Object.entries(await searchParams)) {
    if (Array.isArray(value)) value.forEach(v => sp.append(key, v))
    else if (value !== undefined) sp.set(key, value)
  }
  const qs = sp.toString()
  permanentRedirect(`/app/ai-basics/project${qs ? `?${qs}` : ''}`)
}
