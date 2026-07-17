/** D-052: лид-абзац статьи — крупная вводная проза после заголовка (редакционный
 *  «standfirst»/opening). Только для /articles (см. ARTICLE_COMPONENTS, §8 v2.1). */
export function Lead({ children }: { children: React.ReactNode }) {
  return <p className="article-lead-block">{children}</p>
}
