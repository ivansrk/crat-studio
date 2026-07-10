import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { MDXRemote } from 'next-mdx-remote/rsc'
import { getCourse, getLesson, assetBase, nextLessonId } from '@/lib/content'
import { mdxComponents } from '@/components/mdx'
import { Video } from '@/components/mdx/Video'
import { currentUser } from '@/lib/auth/current-user'
import { hasCourseAccess } from '@/lib/progress/access'
import { ensureProgress, getLessonState } from '@/lib/progress'
import { startQuizAction, togglePracticeAction, saveMissionAction } from '@/app/actions/lesson'
import { t } from '@/lib/i18n'

/** Ф7в T3: /app/{courseSlug}/lessons/{lessonId} — перенос app/app/lessons/[lessonId]/page.tsx
 *  с параметризацией (MC-04). Логика не меняется. */
export default async function LessonPage({ params }: { params: Promise<{ courseSlug: string; lessonId: string }> }) {
  const { courseSlug, lessonId } = await params
  const entry = getCourse(courseSlug)
  if (!entry || !entry.published) notFound() // MC-01/02

  // currentUser не null после layout-гейта (app/app/layout.tsx), но TS этого не знает —
  // на всякий случай (истёкшая сессия между рендерами) отправляем на /login, а не падаем.
  const user = await currentUser()
  if (!user) redirect('/login')
  if (!(await hasCourseAccess(user, courseSlug))) redirect(`/app/${courseSlug}`) // MC-07

  const lesson = getLesson(courseSlug, lessonId)
  if (!lesson) return <main><p>{t.lesson.unavailable}</p></main>
  await ensureProgress(user.id, courseSlug, lessonId) // только для валидного урока — битые/несуществующие не создают LessonProgress
  const state = await getLessonState(user.id, courseSlug, lessonId)
  const base = assetBase(courseSlug, lesson)
  const next = nextLessonId(courseSlug, lessonId)
  return (
    <main className="lesson-page">
      <h1 className="crat-display">{lesson.meta.title}</h1>
      {lesson.meta.video_id
        ? <Video kinescope={lesson.meta.video_id} />
        : <p className="mdx-trainer-stub">{t.lesson.videoSoon}</p>}
      <div className="lesson-mdx">
        <MDXRemote source={lesson.mdx} components={mdxComponents(base)} />
      </div>
      {lesson.hasCheatsheet && <p><a className="crat-button" href={`${base}/cheatsheet.pdf`} download>{t.lesson.downloadCheatsheet}</a></p>}

      {state.quizPassed ? (
        <>
          <p>{t.lesson.quizPassed}</p>
          <form action={startQuizAction}>
            <input type="hidden" name="courseSlug" value={courseSlug} />
            <input type="hidden" name="lessonId" value={lessonId} />
            <button className="crat-button" type="submit">{t.lesson.retakeQuiz}</button>
          </form>
        </>
      ) : (
        <form action={startQuizAction}>
          <input type="hidden" name="courseSlug" value={courseSlug} />
          <input type="hidden" name="lessonId" value={lessonId} />
          <button className="crat-button primary" type="submit">{t.lesson.finishLesson}</button>
        </form>
      )}

      <section className="crat-card">
        <h2>{t.lesson.practiceTitle}</h2>
        <MDXRemote source={lesson.practiceMd} components={mdxComponents(base)} />
        <form action={togglePracticeAction}>
          <input type="hidden" name="courseSlug" value={courseSlug} />
          <input type="hidden" name="lessonId" value={lessonId} />
          <label>
            <input type="checkbox" name="done" defaultChecked={state.practiceDone} />
            {' '}{t.lesson.practiceDone}
          </label>
          <p><button className="crat-button" type="submit">{t.lesson.save}</button></p>
        </form>
      </section>

      {state.completed && <p>🎉 {t.lesson.completed}</p>}

      {/* Миссия — ДО ссылки «Следующий урок» (рефлексия до выхода из урока).
          mission_prompt — контент-флаг, урок может быть любым → returnTo из lessonId. */}
      {lesson.meta.mission_prompt && (
        <section className="crat-card cabinet-mission">
          <h2>{t.lesson.missionTitle}</h2>
          <p className="crat-muted">{t.lesson.missionHint}</p>
          <form action={saveMissionAction}>
            <input type="hidden" name="courseSlug" value={courseSlug} />
            <input type="hidden" name="returnTo" value={`/app/${courseSlug}/lessons/${lessonId}`} />
            <textarea name="mission" defaultValue={user.mission ?? ''} />
            <p><button className="crat-button" type="submit">{t.lesson.save}</button></p>
          </form>
        </section>
      )}

      <p>
        {next
          ? <Link className="crat-button primary" href={`/app/${courseSlug}/lessons/${next}`}>{t.lesson.nextLesson}</Link>
          : t.lesson.courseDone}
      </p>
    </main>
  )
}
