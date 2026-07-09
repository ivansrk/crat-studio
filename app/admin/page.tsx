import { db } from '@/lib/db'
import { GrantForm } from './GrantForm'
import { t } from '@/lib/i18n'

export const dynamic = 'force-dynamic'
export default async function Registrations() {
  const regs = await db.registration.findMany({ orderBy: { updatedAt: 'desc' } })
  return (
    <main className="admin-wide">
      <h1>{t.admin.registrations}</h1>
      {regs.length === 0 ? <p>{t.admin.noData}</p> : (
        <table className="admin-table">
          <thead>
          <tr>
            <th>{t.admin.colName}</th>
            <th>{t.admin.colEmail}</th>
            <th>{t.admin.colStatus}</th>
            <th>{t.admin.colActions}</th>
          </tr>
          </thead>
          <tbody>
          {regs.map(r => (
            <tr key={r.id}>
              <td>{r.firstName} {r.lastName}</td>
              <td>{r.email}</td>
              <td>
                {r.status === 'ENROLLED' ? t.admin.statusEnrolled : r.status === 'RESUBMITTED' ? t.admin.resubmitted : t.admin.statusNew}
                {r.submitCount > 1 && ` ×${r.submitCount}`}
                {r.alreadyEnrolled && r.status !== 'ENROLLED' && ` · ${t.admin.alreadyEnrolled}`}
              </td>
              <td>{r.status !== 'ENROLLED' && <GrantForm registrationId={r.id} />}</td>
            </tr>
          ))}
          </tbody>
        </table>
      )}
    </main>
  )
}
