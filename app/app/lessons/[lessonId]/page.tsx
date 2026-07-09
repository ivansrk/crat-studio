import { redirect } from 'next/navigation'
import { MDXRemote } from 'next-mdx-remote/rsc'
import { getLesson, assetBase } from '@/lib/content'
import { mdxComponents } from '@/components/mdx'
import { Video } from '@/components/mdx/Video'
import { currentUser } from '@/lib/auth/current-user'
import { hasCourseAccess } from '@/lib/progress/access'
import { ensureProgress } from '@/lib/progress'
import { t } from '@/lib/i18n'

export default async function LessonPage({ params }: { params: Promise<{ lessonId: string }> }) {
  const { lessonId } = await params
  // currentUser не null после layout-гейта (app/app/layout.tsx), но TS этого не знает —
  // на всякий случай (истёкшая сессия между рендерами) отправляем на /login, а не падаем.
  const user = await currentUser()
  if (!user) redirect('/login')
  if (!(await hasCourseAccess(user))) redirect('/app')

  const lesson = getLesson(lessonId)
  if (!lesson) return <main><p>{t.lesson.unavailable}</p></main>
  await ensureProgress(user.id, lessonId) // только для валидного урока — битые/несуществующие не создают LessonProgress
  const base = assetBase(lesson)
  return (
    <main>
      <h1>{lesson.meta.title}</h1>
      {lesson.meta.video_id
        ? <Video kinescope={lesson.meta.video_id} />
        : <p className="mdx-trainer-stub">{t.lesson.videoSoon}</p>}
      <MDXRemote source={lesson.mdx} components={mdxComponents(base)} />
      {lesson.hasCheatsheet && <p><a className="mdx-download" href={`${base}/cheatsheet.pdf`} download>{t.lesson.downloadCheatsheet}</a></p>}
      <p><button className="mdx-download" disabled>{t.lesson.finishLesson}</button></p>
    </main>
  )
}
