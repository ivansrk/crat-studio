import { contentErrors, getContent } from '@/lib/content'
import { t } from '@/lib/i18n'

export const dynamic = 'force-dynamic'

export default function Health() {
  const errors = contentErrors()
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
    </main>
  )
}
