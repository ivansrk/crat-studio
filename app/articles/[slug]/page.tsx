import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import { MDXRemote } from 'next-mdx-remote/rsc'
import Link from 'next/link'
import { getArticle, getArticles } from '@/lib/content'
import { mdxComponents } from '@/components/mdx'
import { formatDate } from '@/lib/i18n/format-date'
import { t } from '@/lib/i18n'
import { SiteHeader } from '@/components/site/SiteHeader'
import { SiteFooter } from '@/components/site/SiteFooter'
import { JsonLd, articleSchema } from '@/components/site/JsonLd'

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const article = getArticle(slug)
  if (!article) return {}
  return {
    title: article.meta.title,
    description: article.meta.description,
    alternates: { canonical: `/articles/${slug}` },
    openGraph: { type: 'article', title: article.meta.title, description: article.meta.description },
  }
}

/**
 * /articles/{slug} — статья на том же MDX-движке, что уроки, но без <Trainer>
 * (§8, TRN-06 — тренажёры только студентам). draft и несуществующий slug — notFound
 * (ART-02): getArticle() уже отфильтровывает draft-статьи, так что 404 неразличимы.
 * Узкая колонка чтения — обычный <main> (46rem, как у уроков, app/globals.css).
 */
export default async function ArticlePage({ params }: Props) {
  const { slug } = await params
  const article = getArticle(slug)
  if (!article) notFound()

  const base = `/content-assets/articles/${slug}`

  // V1 (перелинковка): «Читать ещё» — до 3 соседних статей. getArticles() уже отсортирован
  // детерминированно (дата desc, при равенстве slug по алфавиту, lib/content/articles.ts) —
  // берём идущие следом за текущей с закольцовыванием. Без рандома → стабильно для SSG.
  const all = getArticles()
  const idx = all.findIndex(a => a.meta.slug === slug)
  const related = [...all.slice(idx + 1), ...all.slice(0, idx)].slice(0, 3)

  return (
    <>
      <JsonLd data={articleSchema(article)} />
      <SiteHeader />
      <main>
        {article.meta.cover && (
          <div className="article-cover">
            <Image
              src={`/images/${article.meta.cover}`}
              alt={article.meta.title}
              fill
              priority
              sizes="(max-width: 800px) 100vw, 46rem"
            />
          </div>
        )}
        <p className="crat-kicker">{t.articles.kicker} · {formatDate(new Date(article.meta.date))}</p>
        <h1 className="crat-display">{article.meta.title}</h1>
        {/* T7 дизайн-аудита (Б.6): лид статьи — meta.description раньше выводился только
            в <meta name="description">, в теле статьи отсутствовал. */}
        <p className="article-lead crat-em">{article.meta.description}</p>
        <MDXRemote source={article.mdx} components={mdxComponents(base)} />

        {/* V1 (перелинковка): тихий конец статьи — mono-кикер + список соседних статей, не
            рекомендательная лента. Возврат к списку всегда, блок «Читать ещё» — если есть соседи. */}
        <nav className="article-more" aria-label={t.articles.readMore}>
          {related.length > 0 && (
            <>
              <p className="crat-kicker">{t.articles.readMore}</p>
              <ul className="article-more-list">
                {related.map(a => (
                  <li key={a.meta.slug}>
                    <Link className="reveal-line" href={`/articles/${a.meta.slug}`}>{a.meta.title}</Link>
                  </li>
                ))}
              </ul>
            </>
          )}
          <p><Link className="reveal-line" href="/articles">{t.articles.allArticles}</Link></p>
        </nav>
      </main>
      <SiteFooter />
    </>
  )
}
