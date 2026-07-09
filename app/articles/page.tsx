import type { Metadata } from 'next'
import Link from 'next/link'
import { getArticles } from '@/lib/content'
import { formatDate } from '@/lib/i18n/format-date'
import { t } from '@/lib/i18n'
import { SiteHeader } from '@/components/site/SiteHeader'
import { SiteFooter } from '@/components/site/SiteFooter'
import { SectionLabel } from '@/components/site/SectionLabel'

export const metadata: Metadata = {
  title: t.seo.articlesTitle,
  description: t.seo.articlesDescription,
  alternates: { canonical: '/articles' },
}

/**
 * /articles — публичный список статей (ART-01/02, тот же MDX-движок, что уроки).
 * Раздел опционален по контракту §8: пустой content/articles/ → t.articles.empty,
 * сайт не падает (getArticles() уже никогда не бросает).
 */
export default function ArticlesPage() {
  const articles = getArticles()

  return (
    <>
      <SiteHeader />
      <main className="crat-page">
        <section className="crat-section">
          <div className="crat-shell">
            <SectionLabel kicker={t.articles.kicker} />
            <h1 className="crat-display">{t.seo.articlesTitle}</h1>
            {articles.length === 0 ? (
              <p className="crat-muted">{t.articles.empty}</p>
            ) : (
              <div className="crat-grid articles-grid">
                {articles.map(a => (
                  <article key={a.meta.slug} className="crat-card article-card">
                    <Link href={`/articles/${a.meta.slug}`}>
                      <h2>{a.meta.title}</h2>
                    </Link>
                    <p className="crat-muted">{a.meta.description}</p>
                    <p className="crat-kicker">{formatDate(new Date(a.meta.date))}</p>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
