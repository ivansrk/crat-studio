const ICONS = { idea: '💡', warning: '⚠️', example: '🧭' } as const

export function Callout({
  type = 'idea',
  children,
}: {
  type?: keyof typeof ICONS
  children: React.ReactNode
}) {
  return (
    <aside className={`mdx-callout mdx-callout-${type}`} aria-label={type}>
      {ICONS[type]} {children}
    </aside>
  )
}
