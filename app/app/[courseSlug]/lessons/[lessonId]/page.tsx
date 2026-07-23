import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { MDXRemote } from 'next-mdx-remote/rsc'
import { getCourse, getLesson, assetBase, nextLessonId, prevLessonId, lessonPosition } from '@/lib/content'
import { mdxComponents } from '@/components/mdx'
import { Video } from '@/components/mdx/Video'
import { currentUser } from '@/lib/auth/current-user'
import { hasCourseAccess } from '@/lib/progress/access'
import { ensureProgress, getLessonState, getCourseProgress } from '@/lib/progress'
import { isLessonPassed } from '@/lib/progress/quiz-logic'
import { LessonNav, type RailModule } from '@/components/site/LessonNav'
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

  // S1 (D-051): данные меню уроков — программа курса (course.yaml) + отметка «пройден»
  // из прогресса (переиспользуем isLessonPassed, тот же критерий, что на курсовой странице).
  const { course } = entry
  const { byLesson } = await getCourseProgress(user.id, courseSlug)
  const railModules: RailModule[] = course.modules.map(m => ({
    id: m.id,
    title: m.title,
    lessons: m.lessons.map(l => ({
      id: l.id,
      title: l.title,
      passed: isLessonPassed(byLesson.get(l.id)),
      current: l.id === lessonId,
    })),
  }))
  const flatIds = course.modules.flatMap(m => m.lessons.map(l => l.id))
  const globalIndex = flatIds.indexOf(lessonId) + 1 // «Урок N из 12» — глобальный номер по course.yaml

  return (
    <div className="lesson-layout">
      <LessonNav
        courseSlug={courseSlug}
        modules={railModules}
        globalIndex={globalIndex}
        globalTotal={flatIds.length}
        prevId={prev}
        nextId={next}
      />
      <main className="lesson-page">
      {/* NAV-10: видимый возврат к обзору курса (модули/прогресс/проект) — ссылка в шапке
          (NAV-07) есть, но её аффорданс невидим для аудитории 40+ (жалоба Ивана 2026-07-23). */}
      <p className="lesson-breadcrumb">
        <Link className="lesson-breadcrumb-link" href={`/app/${courseSlug}`}>{t.lesson.backToCourse}</Link>
      </p>
      {positionText && <p className="lesson-position crat-kicker">{positionText}</p>}
      <h1 className="crat-display">{lesson.meta.title}</h1>
      {/* Ревью T4-T5 m5: компактный чек-лист «квиз/практика» под заголовком — план T5 требовал
          его, реализован не был. Мята = сделано, приглушённый (унаследован от .crat-kicker) —
          нет; символы вместо эмодзи (crat-design: emoji в UI запрещены). */}
      <p className="lesson-checklist crat-kicker">
        {t.lesson.checklistQuizLabel}{' '}
        <span className={state.quizPassed ? 'lesson-checklist-done' : undefined}>
          {state.quizPassed ? t.lesson.checklistDoneMark : t.lesson.checklistPendingMark}
        </span>
        {' · '}
        {t.lesson.checklistPracticeLabel}{' '}
        <span className={state.practiceDone ? 'lesson-checklist-done' : undefined}>
          {state.practiceDone ? t.lesson.checklistDoneMark : t.lesson.checklistPendingMark}
        </span>
      </p>
      {lesson.meta.video_id
        ? <Video kinescope={lesson.meta.video_id} />
        : (
          <div className="crat-visual-frame horizon crat-noise lesson-video-stub">
            <p className="lesson-video-stub-text crat-kicker">{t.lesson.videoSoon}</p>
          </div>
        )}
      {/* Чтение — основная проза урока. */}
      <div className="lesson-mdx">
        <MDXRemote source={lesson.mdx} components={mdxComponents(base, lessonId)} />
      </div>

      {/* T10 дизайн-урок: страница урока выстроена как маршрут «читаю → пробую →
          проверяю себя». Материалы и практика — сразу после чтения, квиз — в конце.
          Это только порядок независимых презентационных блоков (у каждой формы свой
          server action, общего состояния нет) и mono-кикеры «станций»; бизнес-логика,
          условия и квиз-механика не тронуты. */}

      {/* Материалы урока — станция «шпаргалка». */}
      {lesson.hasCheatsheet && (
        <section className="lesson-station lesson-station-materials">
          <p className="lesson-station-kicker crat-kicker">{t.lesson.stationMaterials}</p>
          <a className="crat-button" href={`${base}/cheatsheet.pdf`} download>{t.lesson.downloadCheatsheet}</a>
        </section>
      )}

      {/* Пробую — станция практики (заголовок даёт h1 из practice.md). */}
      <section className="crat-card lesson-station lesson-station-practice">
        <p className="lesson-station-kicker crat-kicker">{t.lesson.stationPractice}</p>
        <div className="lesson-mdx">
          <MDXRemote source={lesson.practiceMd} components={mdxComponents(base, lessonId)} />
        </div>
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

      {/* Проверяю себя — станция квиза. */}
      <section className="lesson-station lesson-station-quiz">
        <p className="lesson-station-kicker crat-kicker">{t.lesson.stationQuiz}</p>
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
      </section>

      {/* T5 дизайн-аудита: 🎉 → mono-статус с мятной чертой (дезэмодзификация). */}
      {state.completed && (
        <p className="status-badge-ready">
          {t.lesson.completed}
          <span className="crat-red-line crat-mint-line" aria-hidden />
        </p>
      )}

      {/* Миссия — ДО навигации по урокам (рефлексия до выхода из урока). mission_prompt —
          контент-флаг (сейчас только у 1.1), урок может быть любым → returnTo из lessonId.
          T4 дизайн-аудита: на уроке блок показывается, только пока миссия пуста — на
          курсовой странице (/app/{courseSlug}) она остаётся всегда (перечитать/поправить). */}
      {lesson.meta.mission_prompt && !user.mission && (
        <section className="crat-card cabinet-mission lesson-station">
          <p className="lesson-station-kicker crat-kicker">{t.lesson.stationMission}</p>
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
    </div>
  )
}
