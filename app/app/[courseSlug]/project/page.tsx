import { notFound, redirect } from 'next/navigation'
import { currentUser } from '@/lib/auth/current-user'
import { hasCourseAccess } from '@/lib/progress/access'
import { getCourse } from '@/lib/content'
import { getCurrentSubmission } from '@/lib/project'
import { PROJECT_FIELDS, type ProjectField } from '@/lib/project/fields'
import { saveDraftAction, submitProjectAction } from '@/app/actions/project'
import { SectionLabel } from '@/components/site/SectionLabel'
import { t } from '@/lib/i18n'

const FIELD_LABEL: Record<ProjectField, string> = {
  task: t.project.fieldTask,
  tool: t.project.fieldTool,
  prompt: t.project.fieldPrompt,
  result: t.project.fieldResult,
  refined: t.project.fieldRefined,
  verified: t.project.fieldVerified,
  application: t.project.fieldApplication,
}

const BANNER: Record<string, string> = {
  saved: t.project.bannerSaved,
  submitted: t.project.bannerSubmitted,
  incomplete: t.project.bannerIncomplete,
  locked: t.project.bannerLocked,
}

/** /app/{courseSlug}/project — перенос app/app/project/page.tsx с параметризацией
 *  (MC-04/PROJ-01…06). Внутренняя страница кабинета — не crat-page/crat-section/crat-shell
 *  (это лендинговый каркас с хедером/футером), а простой main как у lessons/[lessonId]
 *  (гейт — app/app/layout.tsx). */
export default async function ProjectPage({ params, searchParams }: {
  params: Promise<{ courseSlug: string }>; searchParams: Promise<{ project?: string }>
}) {
  const { courseSlug } = await params
  const { project } = await searchParams
  const entry = getCourse(courseSlug)
  if (!entry || !entry.published) notFound() // MC-01/02

  // currentUser не null после layout-гейта, но TS этого не знает (истёкшая сессия между рендерами) —
  // паттерн из app/app/[courseSlug]/page.tsx/lessons/[lessonId].
  const user = await currentUser()
  if (!user) redirect('/login')
  if (!(await hasCourseAccess(user, courseSlug))) redirect(`/app/${courseSlug}`) // MC-07

  const submission = await getCurrentSubmission(user.id, courseSlug)
  const banner = project ? BANNER[project] : undefined
  const isAlertBanner = project === 'incomplete' || project === 'locked'
  const readOnly = submission?.status === 'SUBMITTED' || submission?.status === 'APPROVED'

  return (
    <main className="project-page">
      <SectionLabel kicker={t.project.kicker} />
      <h1 className="crat-display">{t.project.title}</h1>
      <p className="crat-muted">{t.project.intro}</p>

      {banner && (
        isAlertBanner
          ? <p role="alert" className="form-alert">{banner}</p>
          : <p className="crat-muted">{banner}</p>
      )}

      {submission?.status === 'SUBMITTED' && (
        <div className="crat-card">
          <p className="status-badge-calm">{t.project.statusSubmittedTitle}</p>
          <p>{t.project.statusSubmittedBody}</p>
        </div>
      )}
      {/* T5 дизайн-аудита: 🎉 → mono-статус с мятной чертой (тот же приём, что «Урок пройден»). */}
      {submission?.status === 'APPROVED' && (
        <div className="crat-card">
          <p className="status-badge-ready">
            {t.project.statusApprovedTitle}
            <span className="crat-red-line crat-mint-line" aria-hidden />
          </p>
          <p>{t.project.statusApprovedBody}</p>
        </div>
      )}
      {/* T5 дизайн-аудита (П6): alert-карточка с красной линией — комментарий проверяющего
          крупно, до самой формы (не «шёпот» цветом текста, как раньше .form-alert). Подсветку
          конкретного поля не делаем — номер поля из свободного текста комментария не
          парсится надёжно ([РЕШЕНИЕ АВТОРА], см. отчёт задачи). */}
      {submission?.status === 'NEEDS_CHANGES' && submission.adminComment && (
        <div className="crat-card alert-card" role="alert">
          <h2 className="crat-kicker">{t.project.adminCommentTitle}</h2>
          <span className="crat-red-line alert-card-line" aria-hidden />
          <p className="admin-comment-text">{submission.adminComment}</p>
        </div>
      )}

      {/* T5 (П6): поля пронумерованы mono 01–07 — тот же порядок, что PROJECT_FIELDS/форма. */}
      {readOnly ? (
        <div className="crat-card project-form">
          {PROJECT_FIELDS.map((field, i) => (
            <label key={field}>
              <span className="project-field-num" aria-hidden>{String(i + 1).padStart(2, '0')}</span>
              {' '}{FIELD_LABEL[field]}
              <textarea defaultValue={submission?.[field] ?? ''} disabled readOnly />
            </label>
          ))}
        </div>
      ) : (
        <form className="crat-card project-form">
          <input type="hidden" name="courseSlug" value={courseSlug} />
          {PROJECT_FIELDS.map((field, i) => (
            <label key={field}>
              <span className="project-field-num" aria-hidden>{String(i + 1).padStart(2, '0')}</span>
              {' '}{FIELD_LABEL[field]}
              <textarea name={field} defaultValue={submission?.[field] ?? ''} />
            </label>
          ))}
          <div className="project-form-actions">
            <button className="crat-button" type="submit" formAction={saveDraftAction}>{t.project.saveDraft}</button>
            <button className="crat-button primary" type="submit" formAction={submitProjectAction}>{t.project.submit}</button>
          </div>
        </form>
      )}
    </main>
  )
}
