import { getArticles, getCourse } from '@/lib/content'
import { t } from '@/lib/i18n'

export const revalidate = 3600

function appUrl(): string {
  return process.env.APP_URL ?? 'http://localhost:3000'
}

/**
 * /llms.txt (SEO-05, GEO) — markdown-сводка сайта для LLM-краулеров,
 * собранная из контента/словаря (никогда из пользовательского ввода).
 */
export async function GET() {
  const base = appUrl()
  // Единственный публикуемый курс сайта; при мультикаталоге — цикл по всем опубликованным курсам.
  const { course } = getCourse('ai-basics')!
  const articles = getArticles()

  const lines: string[] = []
  lines.push('# CRAT studio')
  lines.push('')
  lines.push(t.home.label)
  lines.push('')
  lines.push(t.home.heroSubtitle)
  lines.push('')

  lines.push('## Курс')
  lines.push('')
  lines.push(`### ${course.title}`)
  lines.push('')
  lines.push(t.seo.landingDescription)
  lines.push('')
  for (const courseModule of course.modules) lines.push(`- ${courseModule.title}`)
  lines.push('')
  lines.push(`Подробнее: ${base}/ai-basics`)
  lines.push('')

  lines.push('## Статьи')
  lines.push('')
  if (articles.length === 0) {
    lines.push(t.articles.empty)
  } else {
    for (const article of articles) {
      lines.push(`- [${article.meta.title}](${base}/articles/${article.meta.slug}) — ${article.meta.description}`)
    }
  }
  lines.push('')

  lines.push('## Контакты')
  lines.push('')
  lines.push(t.footer.contactEmail)
  lines.push('')

  const body = lines.join('\n')

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
