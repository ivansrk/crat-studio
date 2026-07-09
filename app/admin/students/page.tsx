import { db } from '@/lib/db'
import { formatDate } from '@/lib/i18n/format-date'
import { gdprDeleteAction } from '@/app/actions/admin'
import { t } from '@/lib/i18n'

export const dynamic = 'force-dynamic'
export default async function Students({ searchParams }: { searchParams: Promise<{ gdpr?: string }> }) {
  const { gdpr } = await searchParams
  const users = await db.user.findMany({ include: { enrollments: true }, orderBy: { createdAt: 'desc' } })
  return (
    <main className="admin-wide">
      <h1>{t.admin.students}</h1>
      {gdpr === 'deleted' && <p className="crat-muted">{t.admin.gdprDone}</p>}
      {gdpr === 'mismatch' && <p role="alert" className="form-alert">{t.admin.gdprMismatch}</p>}
      {users.length === 0 ? <p>{t.admin.noData}</p> : (
        <>
          <p><a className="crat-button compact" href="/admin/export/csv">{t.admin.exportCsv}</a></p>
          <table className="admin-table">
            <thead>
            <tr>
              <th>{t.admin.colName}</th>
              <th>{t.admin.colEmail}</th>
              <th>{t.admin.colEnrolledAt}</th>
              <th></th>
              <th>{t.admin.colActions}</th>
            </tr>
            </thead>
            <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td>{u.firstName} {u.lastName}</td>
                <td>{u.email}</td>
                <td>{u.enrollments[0] ? formatDate(u.enrollments[0].createdAt) : ''}</td>
                <td><a className="crat-button compact" href={`/admin/students/${u.id}`}>{t.admin.progress}</a></td>
                <td>
                  <form action={gdprDeleteAction}>
                    <input type="hidden" name="userId" value={u.id} />
                    <input name="confirmEmail" placeholder={t.admin.gdprConfirm} required />
                    <button className="crat-button compact danger" type="submit">{t.admin.gdprDelete}</button>
                  </form>
                </td>
              </tr>
            ))}
            </tbody>
          </table>
        </>
      )}
    </main>
  )
}
