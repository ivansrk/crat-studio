import fs from 'node:fs'
import path from 'node:path'
import { validateMdx } from './validate-mdx'
import { isNonEmptyString, readYaml, readFile } from './yaml-utils'
import { animationIds } from '@/lib/design/animations/registry'

export type ArticleMeta = {
  slug: string
  title: string
  description: string
  date: string
  draft?: boolean
}
export type Article = { meta: ArticleMeta; mdx: string; dir: string }
export type ArticleIssue = { level: 'error' | 'warning'; slug?: string; message: string }

/**
 * Загружает и валидирует content/articles/{slug}/ (контракт §8, ART-01…03).
 * Раздел опционален: отсутствие каталога — пусто, без ошибок. Никогда не бросает.
 */
export function loadArticles(dir: string): { articles: Article[]; issues: ArticleIssue[] } {
  const issues: ArticleIssue[] = []
  const articles: Article[] = []
  if (!fs.existsSync(dir)) return { articles, issues }

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const slug = entry.name
    const articleDir = path.join(dir, slug)
    const err = (message: string) => issues.push({ level: 'error', slug, message })
    const before = issues.filter(i => i.level === 'error').length

    const meta = readYaml<ArticleMeta>(path.join(articleDir, 'meta.yaml'), err)
    const mdx = readFile(path.join(articleDir, 'article.mdx'), err)

    if (meta) {
      if (meta.slug !== slug) err(`slug "${meta.slug}" ≠ каталогу "${slug}"`)
      // не-строка (yaml `title: 12345`) — ошибка контента, а не TypeError (правило 6)
      if (!isNonEmptyString(meta.title)) err('title пуст или не строка')
      if (!isNonEmptyString(meta.description)) err('description пуст или не строка')
      if (!meta.date || Number.isNaN(Date.parse(String(meta.date)))) err(`date некорректна: "${meta.date}"`)
    }
    if (mdx !== null) {
      const assetsDir = path.join(articleDir, 'assets')
      const existingAssets = new Set<string>(
        fs.existsSync(assetsDir) ? fs.readdirSync(assetsDir).map(f => `assets/${f}`) : [],
      )
      // Trainer запрещён в статьях: тренажёры — только студентам (TRN-06, §8).
      for (const m of validateMdx(mdx, { existingAssets, animationIds, forbidComponents: ['Trainer'] }))
        err(`article.mdx: ${m}`)
    }

    if (issues.filter(i => i.level === 'error').length > before) continue
    articles.push({ meta: meta as ArticleMeta, mdx: mdx as string, dir: articleDir })
  }
  return { articles, issues }
}

/**
 * Опубликованные статьи (без draft), по дате по убыванию (ART-02).
 * Тай-брейк при равных датах — slug asc: порядок readdir не гарантирован,
 * а список публично виден в /articles и sitemap.
 */
export function publishedArticles(articles: Article[]): Article[] {
  return articles
    .filter(a => !a.meta.draft)
    .slice()
    .sort((a, b) =>
      Date.parse(b.meta.date) - Date.parse(a.meta.date) || a.meta.slug.localeCompare(b.meta.slug),
    )
}
