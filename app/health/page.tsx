import { articleIssues, contentErrors, getContent } from '@/lib/content'
import { t } from '@/lib/i18n'

export const dynamic = 'force-dynamic'

export default function Health() {
  const errors = contentErrors()
  // Статьи — отдельный блок: их ошибки не влияют на статус курса (ART-03,
  // раздел опционален), поэтому заголовок ✅/❌ считается только по урокам.
  const artErrors = articleIssues().filter(i => i.level === 'error')
  return (
    <main>
      <h1>{errors.length === 0 ? `✅ ${t.health.ok}` : `❌ ${t.health.contentErrors}`}</h1>
      <p>
        {t.health.contentValid}: {getContent().lessons.size}/12
      </p>
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
