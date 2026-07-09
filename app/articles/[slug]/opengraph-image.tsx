import { ImageResponse } from 'next/og'
import { getArticle } from '@/lib/content'
import { t } from '@/lib/i18n'

export const alt = 'CRAT studio — статья'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

type Props = { params: Promise<{ slug: string }> }

/**
 * OG-картинка статьи (SEO-02). Стиль CRAT литералами (см. app/opengraph-image.tsx
 * для пояснения про дефолтный шрифт satori). Заголовок — meta.title статьи;
 * несуществующий/draft slug (ART-02) — не 404 (OG-конвенция next/og не поддерживает
 * notFound() здесь), а дефолт с брендом, чтобы роут никогда не падал (правило 6).
 */
export default async function Image({ params }: Props) {
  const { slug } = await params
  const article = getArticle(slug)
  const title = article ? article.meta.title : t.home.brand

  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          backgroundColor: '#0E0B0B',
          padding: '80px',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex' }}>
            <span
              style={{
                display: 'flex',
                fontSize: 26,
                color: '#B9A7D6',
                textTransform: 'uppercase',
                letterSpacing: 6,
              }}
            >
              {t.articles.kicker}
            </span>
          </div>
          <div
            style={{
              display: 'flex',
              width: 80,
              height: 4,
              marginTop: 28,
              backgroundColor: '#FF4B3A',
              boxShadow: '0 0 24px rgba(255,75,58,.45)',
            }}
          />
          <div style={{ display: 'flex', marginTop: 36 }}>
            <span
              style={{
                display: 'flex',
                fontSize: 56,
                lineHeight: 1.2,
                color: '#F2E9DC',
                fontWeight: 600,
              }}
            >
              {title}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex' }}>
          <span style={{ display: 'flex', fontSize: 24, color: '#BEB8AD' }}>cratstudio.com</span>
        </div>
      </div>
    ),
    { ...size }
  )
}
