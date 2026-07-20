import { db } from '@/lib/db'
import { formatDateTime } from '@/lib/i18n/format-date'
import { isStaleQueued } from '@/lib/admin/resend-email'
import { resendEmailAction } from '@/app/actions/admin'
import { t } from '@/lib/i18n'

export const dynamic = 'force-dynamic'
export default async function Emails({ searchParams }: { searchParams: Promise<{ resend?: string }> }) {
  const { resend } = await searchParams
  const logs = await db.emailLog.findMany({ orderBy: { createdAt: 'desc' }, take: 100 })
  const now = new Date()
  return (
    <main className="admin-wide">
      <h1>{t.admin.emails}</h1>
      {resend === 'ok' && <p className="crat-muted">{t.admin.resent}</p>}
      {resend === 'user_gone' && <p role="alert" className="form-alert">{t.admin.emailUserGone}</p>}
      {resend === 'unsupported' && <p role="alert" className="form-alert">{t.admin.emailUnsupported}</p>}
      {resend === 'opt_in_done' && <p className="crat-muted">{t.admin.emailOptInDone}</p>}
      {resend === 'cert_gone' && <p role="alert" className="form-alert">{t.admin.emailCertGone}</p>}
      {resend === 'send_failed' && <p role="alert" className="form-alert">{t.admin.emailSendFailed}</p>}
      {logs.length === 0 ? (
        <div className="crat-card">
          <p>{t.admin.emailsEmptyTitle}</p>
          <p className="crat-muted">{t.admin.emailsEmptyBody}</p>
        </div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
            <tr>
              <th>{t.admin.colDate}</th>
              <th>{t.admin.colTo}</th>
              <th>{t.admin.colType}</th>
              <th>{t.admin.colStatus}</th>
              <th>{t.admin.colError}</th>
              <th>{t.admin.colActions}</th>
            </tr>
            </thead>
            <tbody>
            {logs.map(log => {
              const stuck = isStaleQueued(log, now)
              return (
                <tr key={log.id}>
                  <td>{formatDateTime(log.createdAt)}</td>
                  <td>{log.toEmail}</td>
                  <td>{t.admin.emailType[log.type]}</td>
                  <td className={log.status === 'FAILED' || stuck ? 'form-alert' : undefined}>
                    {log.status === 'QUEUED' ? (stuck ? t.admin.emailStuck : t.admin.emailQueued) : t.admin.emailStatus[log.status]}
                    {log.attempts > 0 && ` (${log.attempts})`}
                  </td>
                  <td>{log.lastError ?? ''}</td>
                  <td>
                    <form action={resendEmailAction}>
                      <input type="hidden" name="emailLogId" value={log.id} />
                      <button className="crat-button compact" type="submit">{t.admin.resend}</button>
                    </form>
                  </td>
                </tr>
              )
            })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  )
}
