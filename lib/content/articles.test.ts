import { describe, it, expect } from 'vitest'
import path from 'node:path'
import { loadArticles, publishedArticles } from './articles'
import type { Article } from './articles'

const fx = (n: string) => path.join(__dirname, 'fixtures', n)

describe('loadArticles', () => {
  it('валидная статья — без ошибок, попадает в articles', () => {
    const { articles, issues } = loadArticles(fx('articles-valid'))
    expect(issues).toHaveLength(0)
    expect(articles).toHaveLength(1)
    expect(articles[0].meta.slug).toBe('valid-article')
    expect(articles[0].meta.title).toBe('Валидная статья')
    expect(articles[0].mdx).toMatch(/Заголовок/)
  })

  it('draft: true — валидна, попадает в articles с пометкой draft', () => {
    const { articles, issues } = loadArticles(fx('articles-draft'))
    expect(issues.filter(i => i.level === 'error')).toHaveLength(0)
    expect(articles).toHaveLength(1)
    expect(articles[0].meta.draft).toBe(true)
  })

  it('meta.slug ≠ каталогу — error, статья не в articles', () => {
    const { articles, issues } = loadArticles(fx('articles-bad-meta'))
    const msgs = issues.filter(i => i.level === 'error').map(i => i.message).join('\n')
    expect(msgs).toMatch(/slug "wrong-slug" ≠ каталогу "oops"/)
    expect(articles).toHaveLength(0)
  })

  it('битая дата (не парсится) — error, статья не в articles', () => {
    const { articles, issues } = loadArticles(fx('articles-bad-date'))
    const msgs = issues.filter(i => i.level === 'error').map(i => i.message).join('\n')
    expect(msgs).toMatch(/date некорректна/)
    expect(articles).toHaveLength(0)
  })

  it('Trainer в article.mdx — ошибка (тренажёры запрещены в статьях, §8)', () => {
    const { articles, issues } = loadArticles(fx('articles-trainer'))
    const msgs = issues.filter(i => i.level === 'error').map(i => i.message).join('\n')
    expect(msgs).toMatch(/article\.mdx:.*компонент <Trainer> запрещён/)
    expect(articles).toHaveLength(0)
  })

  it('title/description — числа в yaml (без кавычек) — error-issue, БЕЗ исключения', () => {
    const { articles, issues } = loadArticles(fx('articles-nonstring-meta'))
    const msgs = issues.filter(i => i.level === 'error').map(i => i.message).join('\n')
    expect(msgs).toMatch(/title/)
    expect(msgs).toMatch(/description/)
    expect(articles).toHaveLength(0)
  })

  it('несуществующий каталог content/articles — пусто, без ошибок (раздел опционален)', () => {
    const { articles, issues } = loadArticles(fx('articles-does-not-exist'))
    expect(articles).toHaveLength(0)
    expect(issues).toHaveLength(0)
  })
})

describe('publishedArticles', () => {
  const mk = (slug: string, date: string, draft?: boolean): Article => ({
    meta: { slug, title: slug, description: 'd', date, draft },
    mdx: '',
    dir: '',
  })

  it('фильтрует draft и сортирует по дате по убыванию', () => {
    const result = publishedArticles([
      mk('old', '2026-01-01'),
      mk('draft', '2026-06-01', true),
      mk('new', '2026-05-01'),
    ])
    expect(result.map(a => a.meta.slug)).toEqual(['new', 'old'])
  })

  it('тай-брейк при равных датах — slug по возрастанию, независимо от порядка входа', () => {
    const a = mk('alpha', '2026-05-01')
    const b = mk('beta', '2026-05-01')
    expect(publishedArticles([b, a]).map(x => x.meta.slug)).toEqual(['alpha', 'beta'])
    expect(publishedArticles([a, b]).map(x => x.meta.slug)).toEqual(['alpha', 'beta'])
  })
})
