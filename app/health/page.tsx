import { articleIssues, contentErrors, getCourses } from '@/lib/content'
import { t } from '@/lib/i18n'

export const dynamic = 'force-dynamic'

export default function Health() {
  const errors = contentErrors()
  // Статьи — отдельный блок: их ошибки не влияют на статус курса (ART-03,
  // раздел опционален), поэтому заголовок ✅/❌ считается только по урокам.
  const artErrors = articleIssues().filter(i => i.level === 'error')
  // MC-08: по всем курсам реестра (не только ai-basics) — сообщения contentErrors()
  // уже несут slug в префиксе (lib/content/index.ts).
  const courses = getCourses()
  return (
    <main>
      <h1>{errors.length === 0 ? `✅ ${t.health.ok}` : `❌ ${t.health.contentErrors}`}</h1>
      {courses.map(c => (
        <p key={c.slug}>
          {c.slug} ({c.published ? 'published' : 'unpublished'}) — {t.health.contentValid}: {c.lessons.size}
        </p>
      ))}
      {errors.length > 0 && (
        <ul>
          {errors.map((e, i) => (
            <li key={i}>
              {e.lessonId} {e.message}
            </li>
          ))}
        </ul>
      )}
      <p>
        {t.health.articlesLabel}: {artErrors.length} {t.health.articleErrorsWord}
      </p>
      {artErrors.length > 0 && (
        <ul>
          {artErrors.map((e, i) => (
            <li key={i}>
              {e.slug} {e.message}
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
