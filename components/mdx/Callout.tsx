import { t } from '@/lib/i18n'

const ICONS = { idea: '💡', warning: '⚠️', example: '🧭' } as const

export function Callout({
  type = 'idea',
  children,
}: {
  type?: keyof typeof ICONS
  children: React.ReactNode
}) {
  return (
    <aside className={`mdx-callout mdx-callout-${type}`} aria-label={t.callout[type]}>
      <span aria-hidden="true">{ICONS[type]}</span> {children}
    </aside>
  )
}
