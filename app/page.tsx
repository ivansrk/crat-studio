import Link from 'next/link'
import { getContent } from '@/lib/content'
import { t } from '@/lib/i18n'

export default function Home() {
  const { course } = getContent()
  return (
    <main>
      <h1>{t.site.title}</h1>
      <h2>{course.title}</h2>
      {course.modules.map(m => (
        <section key={m.id}>
          <h3>{m.title}</h3>
          <ul>{m.lessons.map(l => (
            <li key={l.id}><Link href={`/app/lessons/${l.id}`}>{l.id} · {l.title}</Link></li>
          ))}</ul>
        </section>
      ))}
    </main>
  )
}
