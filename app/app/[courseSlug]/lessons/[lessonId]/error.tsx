'use client'

import { useEffect } from 'react'
import { t } from '@/lib/i18n'

// MDXRemote компилирует MDX на каждый запрос; AST-валидация контента не гарантирует
// успешную компиляцию — вместо 500 показываем понятную ошибку (правило 6).
export default function LessonError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error('[lesson] ошибка рендера урока:', error)
  }, [error])
  return (
    <main>
      <p>{t.lesson.unavailable}</p>
      <p><button className="crat-button" onClick={reset}>{t.lesson.retry}</button></p>
    </main>
  )
}
