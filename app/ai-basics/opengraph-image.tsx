import { ImageResponse } from 'next/og'
import { getCourse } from '@/lib/content'
import { t } from '@/lib/i18n'

export const alt = 'CRAT studio — курс'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

/**
 * OG-картинка лендинга курса (SEO-02). Стиль CRAT литералами (см. app/opengraph-image.tsx
 * для пояснения про дефолтный шрифт satori). Заголовок — course.title из course.yaml.
 */
export default function Image() {
  // OG-картинка лендинга конкретного курса ai-basics — литерал корректен по смыслу маршрута.
  const { course } = getCourse('ai-basics')!
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
              {t.landing.courseLabel}
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
              {course.title}
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
