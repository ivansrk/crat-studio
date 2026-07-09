import fs from 'node:fs'
import path from 'node:path'
import * as yaml from 'js-yaml'
import { validateMdx } from './validate-mdx'
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
      if (!meta.title?.trim()) err('title пуст')
      if (!meta.description?.trim()) err('description пуст')
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

/** Опубликованные статьи (без draft), отсортированные по дате по убыванию (ART-02). */
export function publishedArticles(articles: Article[]): Article[] {
  return articles
    .filter(a => !a.meta.draft)
    .slice()
    .sort((a, b) => Date.parse(b.meta.date) - Date.parse(a.meta.date))
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === 'object' && !Array.isArray(v)
}

function readYaml<T>(p: string, err: (m: string) => void): T | null {
  const raw = readFile(p, err)
  if (raw === null) return null
  let parsed: unknown
  try {
    parsed = yaml.loadAll(raw)[0]
  } catch (e) {
    err(`${path.basename(p)} не парсится: ${(e as Error).message}`)
    return null
  }
  if (!isPlainObject(parsed)) {
    err(`${path.basename(p)} пуст или не является объектом`)
    return null
  }
  return parsed as T
}

function readFile(p: string, err: (m: string) => void): string | null {
  if (!fs.existsSync(p)) {
    err(`отсутствует обязательный файл ${path.basename(p)}`)
    return null
  }
  return fs.readFileSync(p, 'utf8')
}
