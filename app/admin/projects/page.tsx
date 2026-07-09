import { db } from '@/lib/db'
import { formatDateTime } from '@/lib/i18n/format-date'
import { reviewProjectAction } from '@/app/actions/admin'
import { PROJECT_FIELDS, type ProjectField } from '@/lib/project/fields'
import { t } from '@/lib/i18n'

export const dynamic = 'force-dynamic'

const FIELD_LABEL: Record<ProjectField, string> = {
  task: t.project.fieldTask,
  tool: t.project.fieldTool,
  prompt: t.project.fieldPrompt,
  result: t.project.fieldResult,
  refined: t.project.fieldRefined,
  verified: t.project.fieldVerified,
  application: t.project.fieldApplication,
}

// ?review= баннеры (T6-план); approved/approved_issued/needs_changes — информационные,
// остальные — form-alert (что-то пошло не так, действие не применилось).
const BANNER: Record<string, { text: string; alert: boolean }> = {
  approved: { text: t.admin.reviewApproved, alert: false },
  approved_issued: { text: t.admin.reviewApprovedIssued, alert: false },
  needs_changes: { text: t.admin.reviewNeedsChanges, alert: false },
  conflict: { text: t.admin.reviewConflict, alert: true },
  comment_required: { text: t.admin.reviewCommentRequired, alert: true },
  not_submitted: { text: t.admin.reviewNotSubmitted, alert: true },
  not_found: { text: t.admin.reviewNotFound, alert: true },
}

/** T6: проверка мини-проектов (ADM-06/07). Только SUBMITTED — принятые/отклонённые
 *  уходят со страницы; старые попытки видны студенту, не здесь. */
export default async function AdminProjects({ searchParams }: { searchParams: Promise<{ review?: string }> }) {
  const { review } = await searchParams
  const banner = review ? BANNER[review] : undefined
  const submissions = await db.submission.findMany({
    where: { status: 'SUBMITTED' },
    orderBy: { submittedAt: 'asc' }, // старые сверху — дольше всех ждут проверки
    include: { user: true },
  })

  return (
    <main className="admin-wide">
      <h1>{t.admin.projects}</h1>
      {banner && (
        <p role={banner.alert ? 'alert' : undefined} className={banner.alert ? 'form-alert' : 'crat-muted'}>
          {banner.text}
        </p>
      )}
      {submissions.length === 0 ? <p>{t.admin.noData}</p> : (
        <div className="admin-review-list">
          {submissions.map(sub => (
            <article key={sub.id} className="crat-card">
              <h2>{sub.user.firstName} {sub.user.lastName}</h2>
              <p className="crat-muted">
                {sub.user.email} · {sub.submittedAt ? formatDateTime(sub.submittedAt) : t.admin.notYet}
              </p>
              {PROJECT_FIELDS.map(field => (
                <p key={field}><strong>{FIELD_LABEL[field]}:</strong> {sub[field]}</p>
              ))}
              <form action={reviewProjectAction} className="project-form">
                <input type="hidden" name="submissionId" value={sub.id} />
                <input type="hidden" name="seenUpdatedAt" value={sub.updatedAt.toISOString()} />
                <label>
                  {t.admin.commentLabel}
                  <textarea name="comment" />
                </label>
                <div className="project-form-actions">
                  <button className="crat-button primary" type="submit" name="verdict" value="approve">
                    {t.admin.verdictApprove}
                  </button>
                  <button className="crat-button" type="submit" name="verdict" value="needs_changes">
                    {t.admin.verdictNeedsChanges}
                  </button>
                </div>
              </form>
            </article>
          ))}
        </div>
      )}
    </main>
  )
}
