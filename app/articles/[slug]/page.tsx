import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { MDXRemote } from 'next-mdx-remote/rsc'
import { getArticle } from '@/lib/content'
import { mdxComponents } from '@/components/mdx'
import { formatDate } from '@/lib/i18n/format-date'
import { t } from '@/lib/i18n'
import { SiteHeader } from '@/components/site/SiteHeader'
import { SiteFooter } from '@/components/site/SiteFooter'

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
      <SiteHeader />
      <main>
        <p className="crat-kicker">{t.articles.kicker} · {formatDate(new Date(article.meta.date))}</p>
        <h1 className="crat-display">{article.meta.title}</h1>
        <MDXRemote source={article.mdx} components={mdxComponents(base)} />
      </main>
      <SiteFooter />
    </>
  )
}
