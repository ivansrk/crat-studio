export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { getContent, articleIssues } = await import('./lib/content')
    const { issues } = getContent()
    for (const i of issues.filter(i => i.level === 'error'))
      console.error(`[content] ${i.lessonId ? i.lessonId + ' ' : ''}${i.message}`)
    const warnings = issues.filter(i => i.level === 'warning').length
    if (warnings > 0) console.warn(`[content] предупреждений: ${warnings}`)

    const artIssues = articleIssues()
    for (const i of artIssues.filter(i => i.level === 'error'))
      console.error(`[content] ${i.slug ? i.slug + ' ' : ''}${i.message}`)
    const articleWarnings = artIssues.filter(i => i.level === 'warning').length
    if (articleWarnings > 0) console.warn(`[content] предупреждений (статьи): ${articleWarnings}`)

    try {
      const { syncAdmins } = await import('./lib/auth/sync-admins')
      await syncAdmins()
    } catch (e) {
      console.error('[startup] syncAdmins не выполнен (нет БД?):', (e as Error).message)
    }
  }
}
