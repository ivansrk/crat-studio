import Link from 'next/link'
import { t } from '@/lib/i18n'

const TITLE: Record<string, string> = {
  t1: t.trainers.t1Title,
  t2: t.trainers.t2Title,
  t3: t.trainers.t3Title,
}

const HREF: Record<string, string> = { t1: '/app/trainers/t1' }

/** TRN-07: карточка-ссылка на тренажёр внутри урока — общая страница/прокси с каталогом
 *  (/app/trainers/{id}), поэтому лимиты общие автоматически. Только T1 реализован (ссылка
 *  ведёт на страницу), T2/T3 — заглушка с пометкой t.trainers.comingSoon, без ссылки (D-020).
 *  mode 'inline'/'link' в Ф4 рендерятся одинаково — полноценный inline-режим появится
 *  при спеках course-factory (см. план T5). */
export function Trainer({ id }: { id: string; mode?: 'inline' | 'link' }) {
  const title = TITLE[id] ?? id
  const href = HREF[id]

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
