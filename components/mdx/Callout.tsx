import { t } from '@/lib/i18n'

/** T5 дизайн-аудита: дезэмодзификация — 💡⚠️🧭 (стоковая метафора, запрещена
 *  анти-дефолт-чеклистом skill'а) → mono-лейбл [ИДЕЯ]/[ВНИМАНИЕ]/[ПРИМЕР],
 *  цвет = цвет рамки типа (mdx.css). Видимый текст, не aria-label — читается
 *  и глазами, и скринридером одинаково, дублировать не нужно. */
export function Callout({
  type = 'idea',
  children,
}: {
  type?: 'idea' | 'warning' | 'example'
  children: React.ReactNode
}) {
  return (
    <aside className={`mdx-callout mdx-callout-${type}`}>
      <p className="mdx-callout-label">{t.callout[type]}</p>
      {children}
    </aside>
  )
}
