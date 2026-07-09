import Link from 'next/link'
import { getContent } from '@/lib/content'
import { logoutAction } from '@/app/actions/logout'
import { t } from '@/lib/i18n'

export default function Cabinet() {
  const { course } = getContent()
  return (
    <main>
      <h1>{t.auth.cabinetTitle}</h1>
      <p>{t.auth.cabinetStub}</p>
      {course.modules.map(m => (
        <section key={m.id}><h3>{m.title}</h3>
          <ul>{m.lessons.map(l => <li key={l.id}><Link href={`/app/lessons/${l.id}`}>{l.id} · {l.title}</Link></li>)}</ul></section>
      ))}
      <form action={logoutAction}><button className="mdx-download" type="submit">{t.auth.logout}</button></form>
    </main>
  )
}
