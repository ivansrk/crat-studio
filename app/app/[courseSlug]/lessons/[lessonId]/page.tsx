import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { MDXRemote } from 'next-mdx-remote/rsc'
import { getCourse, getLesson, assetBase, nextLessonId, prevLessonId, lessonPosition } from '@/lib/content'
import { mdxComponents } from '@/components/mdx'
import { Video } from '@/components/mdx/Video'
import { currentUser } from '@/lib/auth/current-user'
import { hasCourseAccess } from '@/lib/progress/access'
import { ensureProgress, getLessonState } from '@/lib/progress'
import { startQuizAction, togglePracticeAction, saveMissionAction } from '@/app/actions/lesson'
import { t } from '@/lib/i18n'

/** /app/{courseSlug}/lessons/{lessonId} — перенос app/app/lessons/[lessonId]/page.tsx
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
  const prev = prevLessonId(courseSlug, lessonId)
  // T4 дизайн-аудита: позиция урока в зоне заголовка («Урок N из M · Модуль K»,
  // из course.yaml через lib/content lessonPosition — не хардкод).
  const position = lessonPosition(courseSlug, lessonId)
  const positionText = position
    ? t.lesson.lessonPosition
        .replace('{index}', String(position.index))
        .replace('{total}', String(position.total))
        .replace('{module}', String(position.moduleId))
    : null
  return (
    <main className="lesson-page">
      {positionText && <p className="lesson-position crat-kicker">{positionText}</p>}
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
          <button className="crat-button primary" type="submit">
            {t.lesson.finishLesson.replace('{n}', String(lesson.quiz.questions.length))}
          </button>
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

      {/* Миссия — ДО навигации по урокам (рефлексия до выхода из урока). mission_prompt —
          контент-флаг (сейчас только у 1.1), урок может быть любым → returnTo из lessonId.
          T4 дизайн-аудита: на уроке блок показывается, только пока миссия пуста — на
          курсовой странице (/app/{courseSlug}) она остаётся всегда (перечитать/поправить). */}
      {lesson.meta.mission_prompt && !user.mission && (
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

      {/* T4 дизайн-аудита: пара компактных ссылок prev/next вместо одной крупной кнопки —
          primary-кнопка «Следующий урок» сохраняется только после прохождения (state.completed),
          до этого next — такая же компактная ссылка, как prev (навигация не заблокирована). */}
      <nav className="lesson-pager" aria-label={t.lesson.pagerAria}>
        {prev && (
          <Link className="reveal-line lesson-pager-prev" href={`/app/${courseSlug}/lessons/${prev}`}>
            {t.lesson.prevLesson}
          </Link>
        )}
        {next ? (
          state.completed
            ? <Link className="crat-button primary lesson-pager-next" href={`/app/${courseSlug}/lessons/${next}`}>{t.lesson.nextLesson}</Link>
            : <Link className="reveal-line lesson-pager-next" href={`/app/${courseSlug}/lessons/${next}`}>{t.lesson.nextLessonShort}</Link>
        ) : (
          <span className="crat-muted lesson-pager-next">{t.lesson.courseDone}</span>
        )}
      </nav>
    </main>
  )
}
