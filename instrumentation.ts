export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { getContent } = await import('./lib/content')
    const { issues } = getContent()
    for (const i of issues) console[i.level === 'error' ? 'error' : 'warn'](`[content] ${i.lessonId ?? ''} ${i.message}`)
  }
}
