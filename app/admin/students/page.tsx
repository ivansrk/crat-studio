import { db } from '@/lib/db'
import { formatDate } from '@/lib/i18n/format-date'
import { t } from '@/lib/i18n'

export const dynamic = 'force-dynamic'
export default async function Students() {
  const users = await db.user.findMany({ include: { enrollments: true }, orderBy: { createdAt: 'desc' } })
  if (users.length === 0) return <main className="admin-wide"><h1>{t.admin.students}</h1><p>{t.admin.noData}</p></main>
  return (
    <main className="admin-wide">
      <h1>{t.admin.students}</h1>
      <p><a className="mdx-download" href="/admin/export/csv">{t.admin.exportCsv}</a></p>
      <table className="admin-table">
        <thead>
        <tr>
          <th>{t.admin.colName}</th>
          <th>{t.admin.colEmail}</th>
          <th>{t.admin.colEnrolledAt}</th>
        </tr>
        </thead>
        <tbody>
        {users.map(u => (
          <tr key={u.id}>
            <td>{u.firstName} {u.lastName}</td>
            <td>{u.email}</td>
            <td>{u.enrollments[0] ? formatDate(u.enrollments[0].createdAt) : ''}</td>
          </tr>
        ))}
        </tbody>
      </table>
    </main>
  )
}
