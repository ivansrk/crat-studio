import { ImageResponse } from 'next/og'
import { t } from '@/lib/i18n'

export const alt = 'CRAT studio'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

/**
 * OG-картинка главной (SEO-02). Стиль CRAT литералами (см. lib/design/tokens.css
 * для эквивалентных токенов — здесь дублируем значениями, т.к. next/og не читает CSS).
 * Шрифт — дефолтный satori: Cormorant Garamond недоступен без загрузки файла шрифта
 * в edge-рантайме OG-роута (внешняя сетевая зависимость на билде/рендере) —
 * осознанное упрощение MVP, системный fallback satori вместо кастомного шрифта.
 */
export default function Image() {
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
              {t.home.label}
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
                fontSize: 58,
                lineHeight: 1.2,
                color: '#F2E9DC',
                fontWeight: 600,
              }}
            >
              {t.home.heroTitle}
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
