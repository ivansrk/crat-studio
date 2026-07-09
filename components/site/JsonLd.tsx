import { t } from '@/lib/i18n'
import type { CourseYaml } from '@/lib/content/types'
import type { Article } from '@/lib/content/articles'

type Schema = Record<string, unknown>

/**
 * Сериализация для JSON-LD: JSON.stringify + `<` → <.
 * <: </script> в данных контента (полудоверенный источник — course-factory)
 * не должен прерывать тег; стандартная практика для JSON-LD. JSON.parse
 * восстанавливает исходник без потерь.
 */
export function safeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}

/**
 * JSON-LD (schema.org, SEO-04). Данные для `data` собираются билдерами ниже
 * только из наших словарей (lib/i18n) и контента (content/*.yaml,
 * content/articles/*) — не из пользовательского ввода. Но контент приходит
 * от course-factory (полудоверенный источник), поэтому `<` экранируем
 * всегда: title со </script> иначе прервал бы ld+json-тег → XSS.
 */
export function JsonLd({ data }: { data: Schema }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJsonLd(data) }}
    />
  )
}

function appUrl(): string {
  return process.env.APP_URL ?? 'http://localhost:3000'
}

/** Organization CRAT studio — вложенный тип (без своего @context) для provider/publisher. */
function organizationNode(): Schema {
  return {
    '@type': 'Organization',
    name: 'CRAT studio',
    url: appUrl(),
    description: t.seo.homeDescription,
    email: t.footer.contactEmail,
  }
}

/** Organization на главной (SITE-01). */
export function organizationSchema(): Schema {
  return { '@context': 'https://schema.org', ...organizationNode() }
}

/** Course на лендинге (SITE-02). Без offers — цены нет до Ф7 (Stripe, D-024), выдумывать нельзя. */
export function courseSchema(course: CourseYaml): Schema {
  return {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: course.title,
    description: t.seo.landingDescription,
    provider: organizationNode(),
    inLanguage: 'ru',
  }
}

/** Article на странице статьи (ART-01…04). */
export function articleSchema(article: Article): Schema {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.meta.title,
    description: article.meta.description,
    datePublished: article.meta.date,
    inLanguage: 'ru',
    publisher: organizationNode(),
  }
}
