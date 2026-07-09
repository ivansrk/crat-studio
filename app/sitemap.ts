import type { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.APP_URL ?? 'http://localhost:3000'
  return [
    { url: `${base}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/ai-basics`, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${base}/register`, changeFrequency: 'weekly', priority: 0.5 },
  ]
}
