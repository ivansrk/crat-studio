import Link from 'next/link'
import { t } from '@/lib/i18n'

const TITLE: Record<string, string> = {
  t1: t.trainers.t1Title,
  t2: t.trainers.t2Title,
  t3: t.trainers.t3Title,
}

const HREF: Record<string, string> = {
  t1: '/app/trainers/t1',
  t2: '/app/trainers/t2', // TRN-08/D-042
  t3: '/app/trainers/t3', // TRN-09/D-042
}

/** TRN-07: карточка-ссылка на тренажёр внутри урока — общая страница/прокси с каталогом
 *  (/app/trainers/{id}), поэтому лимиты общие автоматически. T1/T2/T3 реализованы (ссылка
 *  ведёт на страницу); неизвестный id — заглушка с пометкой t.trainers.comingSoon, без ссылки (D-020).
 *  mode 'inline'/'link' в Ф4 рендерятся одинаково — полноценный inline-режим появится
 *  при спеках course-factory (см. план T5). */
export function Trainer({ id, fromLessonId }: { id: string; mode?: 'inline' | 'link'; fromLessonId?: string }) {
  const title = TITLE[id] ?? id
  // S5/D-051: со страницы урока прокидываем ?from={lessonId} — страница тренажёра покажет
  // «Вернуться к уроку». from валидируется на самой странице тренажёра (по контенту курса).
  const href = HREF[id] ? `${HREF[id]}${fromLessonId ? `?from=${encodeURIComponent(fromLessonId)}` : ''}` : undefined

  if (!href) {
    return (
      <div className="crat-card trainer-card trainer-card-soon mdx-trainer-card">
        <h2>{title}</h2>
        <span className="trainer-badge">{t.trainers.comingSoon}</span>
      </div>
    )
  }

  return (
    <Link href={href} className="crat-card trainer-card mdx-trainer-card" aria-label={`${t.trainers.open}: ${title}`}>
      <h2>{title}</h2>
      <span className="crat-button primary" aria-hidden="true">{t.trainers.open}</span>
    </Link>
  )
}
