import { t } from '@/lib/i18n'

/** D-052: блок источников в конце статьи — тихий mono-кикер + список ссылок.
 *  children — markdown-список (ссылки допустимы, это не картинки). Только /articles (§8 v2.1). */
export function Sources({ children }: { children: React.ReactNode }) {
  return (
    <aside className="mdx-sources" aria-label={t.articles.sourcesTitle}>
      <p className="mdx-sources-label">{t.articles.sourcesTitle}</p>
      {children}
    </aside>
  )
}
