import React from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import { MDXRemote } from 'next-mdx-remote/rsc'
import Link from 'next/link'
import { getArticle, getArticles, articleCoverSrc } from '@/lib/content'
import { extractH2, readingTimeMin, slugifyHeading } from '@/lib/content/toc'
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

/** Плоский текст из детей MDX-заголовка (строки/массивы/inline-элементы) — для id якоря. */
function nodeText(node: React.ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(nodeText).join('')
  if (React.isValidElement(node)) return nodeText((node.props as { children?: React.ReactNode }).children)
  return ''
}

/** h2 статьи с id-якорем (тот же slug, что в оглавлении «В этой статье», D-052). */
function ArticleH2({ children }: { children?: React.ReactNode }) {
  return <h2 id={slugifyHeading(nodeText(children))}>{children}</h2>
}

/**
 * /articles/{slug} — редакционный лонгрид на MDX-движке уроков, без <Trainer>
 * (§8, TRN-06). Компоненты статьи (Lead/PullQuote/KeyPoints/Sources, D-052) —
 * ARTICLE_COMPONENTS, разрешены только здесь. draft/несуществующий slug → notFound
 * (ART-02): getArticle() уже отфильтровывает draft, так что 404 неразличимы.
 */
export default async function ArticlePage({ params }: Props) {
  const { slug } = await params
  const article = getArticle(slug)
  if (!article) notFound()

  const base = `/content-assets/articles/${slug}`
  const components = { ...mdxComponents(base), h2: ArticleH2 }

  // Обложка (D-052): `assets/…` — из каталога статьи, иначе — из public/images/.
  const cover = articleCoverSrc(slug, article.meta.cover)

  const minutes = readingTimeMin(article.mdx)
  const headings = extractH2(article.mdx)

  // V1 (перелинковка): «Читать ещё» — до 3 соседних статей. getArticles() отсортирован
  // детерминированно (дата desc, при равенстве slug по алфавиту) — берём идущие следом
  // с закольцовыванием. Без рандома → стабильно для SSG.
  const all = getArticles()
  const idx = all.findIndex(a => a.meta.slug === slug)
  const related = [...all.slice(idx + 1), ...all.slice(0, idx)].slice(0, 3)

  const metaLine = (
    <p className="article-meta">
      <span>{formatDate(new Date(article.meta.date))}</span>
      <span aria-hidden="true"> · </span>
      <span>{minutes} {t.articles.readingTime}</span>
    </p>
  )

  return (
    <>
      <JsonLd data={articleSchema(article)} />
      <SiteHeader />
      <main className="article-page">
        {cover ? (
          // Обложка-«кадр»: полноширинный кадр с тёмным скримом, заголовок поверх
          // (бриф §3: image is the protagonist). Скрим — для читаемости текста.
          <header className="article-hero">
            <div className="article-hero-media">
              <Image src={cover} alt="" fill priority sizes="100vw" />
            </div>
            <div className="article-hero-scrim" aria-hidden="true" />
            <div className="article-hero-inner">
              <p className="crat-kicker">{t.articles.kicker}</p>
              <h1 className="crat-display article-title">{article.meta.title}</h1>
              {metaLine}
            </div>
          </header>
        ) : (
          // Без обложки — типографическая шапка с крупным заголовком-display.
          <header className="article-header">
            <p className="crat-kicker">{t.articles.kicker}</p>
            <h1 className="crat-display article-title">{article.meta.title}</h1>
            {metaLine}
          </header>
        )}

        <div className="article-body">
          {/* Standfirst: meta.description крупным курсивом — краткое резюме под заголовком. */}
          <p className="article-lead crat-em">{article.meta.description}</p>

          {/* Оглавление «В этой статье» — только для длинных статей (≥4 h2), тихий блок. */}
          {headings.length >= 4 && (
            <nav className="article-toc" aria-label={t.articles.inThisArticle}>
              <p className="crat-kicker">{t.articles.inThisArticle}</p>
              <ol>
                {headings.map(h => (
                  <li key={h.slug}>
                    <a className="reveal-line" href={`#${h.slug}`}>{h.text}</a>
                  </li>
                ))}
              </ol>
            </nav>
          )}

          <div className="article-mdx">
            <MDXRemote source={article.mdx} components={components} />
          </div>

          {/* V1 (перелинковка): тихий конец статьи — mono-кикер + список соседних статей. */}
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
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
