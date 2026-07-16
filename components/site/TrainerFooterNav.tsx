import Link from 'next/link'
import { getLesson } from '@/lib/content'
import { t } from '@/lib/i18n'

/** S5 (аудит навигации 2026-07-16, D-051): нижняя навигация страницы тренажёра.
 *  Всегда — «К тренажёрам». Если тренажёр открыт из урока (?from={lessonId}) и этот
 *  урок реально существует в курсе ai-basics — рядом появляется «Вернуться к уроку "…"».
 *  from валидируется по контенту (getLesson) — рендерим ссылку только на известный
 *  lessonId, а href строим из самого урока: не открытый редирект. */
export function TrainerFooterNav({ from }: { from?: string }) {
  const lesson = from ? getLesson('ai-basics', from) : null
  return (
    <p className="trainer-footer-nav">
      {lesson && (
        <Link className="crat-button" href={`/app/ai-basics/lessons/${lesson.meta.id}`}>
          {t.trainers.backToLesson.replace('{title}', lesson.meta.title)}
        </Link>
      )}
      <Link className="crat-button" href="/app/trainers">{t.trainers.backToCatalog}</Link>
    </p>
  )
}
