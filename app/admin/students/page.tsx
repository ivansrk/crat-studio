import { db } from '@/lib/db'
import { formatDate } from '@/lib/i18n/format-date'
import { parseAdminEmails } from '@/lib/auth/parse-admin-emails'
import { DeleteParticipant } from '@/components/admin/DeleteParticipant'
import { DeleteBanner } from '@/components/admin/DeleteBanner'
import { t } from '@/lib/i18n'

export const dynamic = 'force-dynamic'
export default async function Students({ searchParams }: { searchParams: Promise<{ del?: string }> }) {
  const { del } = await searchParams
  // T8 дизайн-аудита (П2): админы — не студенты, в список не попадают (та же логика,
  // что в lib/crm listClients — фильтр применяется только при непустом ADMIN_EMAILS).
  const adminEmails = parseAdminEmails(process.env.ADMIN_EMAILS)
  const users = await db.user.findMany({
    where: adminEmails.length > 0 ? { email: { notIn: adminEmails } } : undefined,
    include: { enrollments: true },
    orderBy: { createdAt: 'desc' },
  })
  return (
    <main className="admin-wide">
      <h1>{t.admin.students}</h1>
      <DeleteBanner del={del} />
      {users.length === 0 ? <p>{t.admin.noData}</p> : (
        <>
          <p><a className="crat-button compact" href="/admin/export/csv">{t.admin.exportCsv}</a></p>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
              <tr>
                <th>{t.admin.colName}</th>
                <th>{t.admin.colEmail}</th>
                <th>{t.admin.colEnrolledAt}</th>
                <th></th>
                <th></th>
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
                    <DeleteParticipant refType="user" id={u.id} email={u.email} successTo="/admin/students" errorTo="/admin/students" />
                  </td>
                </tr>
              ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  )
}
