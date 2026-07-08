export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { getContent } = await import('./lib/content')
    const { issues } = getContent()
    for (const i of issues.filter(i => i.level === 'error'))
      console.error(`[content] ${i.lessonId ? i.lessonId + ' ' : ''}${i.message}`)
    const warnings = issues.filter(i => i.level === 'warning').length
    if (warnings > 0) console.warn(`[content] предупреждений: ${warnings}`)
  }
}
