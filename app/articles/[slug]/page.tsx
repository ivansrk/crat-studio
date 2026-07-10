import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import { MDXRemote } from 'next-mdx-remote/rsc'
import { getArticle } from '@/lib/content'
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
      </main>
      <SiteFooter />
    </>
  )
}
