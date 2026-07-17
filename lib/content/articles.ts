import fs from 'node:fs'
import path from 'node:path'
import { validateMdx } from './validate-mdx'
import { ARTICLE_COMPONENTS } from './whitelist'
import { isNonEmptyString, readYaml, readFile } from './yaml-utils'
import { animationIds } from '@/lib/design/animations/registry'

export type ArticleMeta = {
  slug: string
  title: string
  description: string
  date: string
  draft?: boolean
  /** Ф7в/D-052: обложка статьи, аддитивное поле контракта §8. Имя файла в public/images/
   *  ЛИБО путь в assets/ статьи (напр. `assets/cover.webp`). Опционально: нет поля →
   *  карточка/шапка без картинки, как раньше. */
  cover?: string
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
      // cover — аддитивное поле §8: warning, не error (не роняем статью из-за отсутствующей картинки).
      // Путь `assets/…` ищем в каталоге статьи, иначе — в public/images/ (D-052).
      if (meta.cover !== undefined) {
        if (!isNonEmptyString(meta.cover)) {
          issues.push({ level: 'warning', slug, message: 'cover задан, но не непустая строка — игнорируется' })
        } else {
          const coverPath = meta.cover.startsWith('assets/')
            ? path.join(articleDir, meta.cover)
            : path.join(process.cwd(), 'public', 'images', meta.cover)
          if (!fs.existsSync(coverPath)) {
            const where = meta.cover.startsWith('assets/') ? `assets/ статьи` : 'public/images/'
            issues.push({ level: 'warning', slug, message: `cover "${meta.cover}" не найден в ${where}` })
          }
        }
      }
    }
    if (mdx !== null) {
      const assetsDir = path.join(articleDir, 'assets')
      const existingAssets = new Set<string>(
        fs.existsSync(assetsDir) ? fs.readdirSync(assetsDir).map(f => `assets/${f}`) : [],
      )
      // Trainer запрещён в статьях: тренажёры — только студентам (TRN-06, §8).
      // ARTICLE_COMPONENTS (Lead/PullQuote/KeyPoints/Sources) разрешены сверх базового
      // белого списка — только в статьях (§8 v2.1/D-052).
      for (const m of validateMdx(mdx, {
        existingAssets,
        animationIds,
        forbidComponents: ['Trainer'],
        extraComponents: [...ARTICLE_COMPONENTS],
      }))
        err(`article.mdx: ${m}`)
    }

    if (issues.filter(i => i.level === 'error').length > before) continue
    articles.push({ meta: meta as ArticleMeta, mdx: mdx as string, dir: articleDir })
  }
  return { articles, issues }
}

/**
 * URL обложки статьи (D-052). `assets/…` — файл в каталоге статьи, отдаётся через
 * маршрут /content-assets/; иначе cover — имя файла в public/images/. null, если поля нет.
 * Знание о раскладке контента живёт в lib/content: и карточка каталога (/articles), и
 * шапка статьи (/articles/{slug}) обязаны резолвить путь одинаково — общий хелпер против
 * расхождения (карточка раньше игнорировала префикс assets/ и давала /images/assets/…).
 */
export function articleCoverSrc(slug: string, cover: string | undefined): string | null {
  if (!cover) return null
  return cover.startsWith('assets/')
    ? `/content-assets/articles/${slug}/${cover}`
    : `/images/${cover}`
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
