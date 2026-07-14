import type { MetadataRoute } from 'next'
import { getArticles } from '@/lib/content'

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.APP_URL ?? 'http://localhost:3000'
  return [
    { url: `${base}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/ai-basics`, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${base}/register`, changeFrequency: 'weekly', priority: 0.5 },
    { url: `${base}/articles`, changeFrequency: 'weekly', priority: 0.8 },
    // Ф7в T5, LEGAL-01: юр-страницы — низкий приоритет/редкие изменения, но должны быть в sitemap.
    { url: `${base}/privacy`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${base}/terms`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${base}/cookies`, changeFrequency: 'yearly', priority: 0.2 },
    // D-045: /refund — новая юр-страница, перенесена со skld.me.
    { url: `${base}/refund`, changeFrequency: 'yearly', priority: 0.2 },
    ...getArticles().map(({ meta }) => ({
      url: `${base}/articles/${meta.slug}`,
      lastModified: new Date(meta.date),
      priority: 0.7,
    })),
  ]
}
