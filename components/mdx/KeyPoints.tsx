import { t } from '@/lib/i18n'

/** D-052: бокс «Главное за 30 секунд» — 3–5 пунктов с mono-кикером, в начале статьи.
 *  children — обычный markdown-список внутри компонента. Только для /articles (§8 v2.1). */
export function KeyPoints({ children }: { children: React.ReactNode }) {
  return (
    <aside className="mdx-keypoints" aria-label={t.articles.keyPointsTitle}>
      <p className="mdx-keypoints-label">{t.articles.keyPointsTitle}</p>
      {children}
    </aside>
  )
}
