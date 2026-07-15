import { db } from '@/lib/db'
import { GrantForm } from './GrantForm'
import { DeleteParticipant } from '@/components/admin/DeleteParticipant'
import { DeleteBanner } from '@/components/admin/DeleteBanner'
import { t } from '@/lib/i18n'
import { formatDate } from '@/lib/i18n/format-date'

export const dynamic = 'force-dynamic'
export default async function Registrations({ searchParams }: { searchParams: Promise<{ del?: string }> }) {
  const { del } = await searchParams
  const regs = await db.registration.findMany({ orderBy: { updatedAt: 'desc' } })
  return (
    <main className="admin-wide">
      <h1>{t.admin.registrations}</h1>
      <DeleteBanner del={del} />
      {regs.length === 0 ? <p>{t.admin.noData}</p> : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
            <tr>
              <th>{t.admin.colName}</th>
              <th>{t.admin.colEmail}</th>
              <th>{t.admin.colSubmittedAt}</th>
              <th>{t.admin.colStatus}</th>
              <th>{t.admin.colActions}</th>
            </tr>
            </thead>
            <tbody>
            {regs.map(r => (
              <tr key={r.id}>
                <td>{r.firstName} {r.lastName}</td>
                <td>{r.email}</td>
                <td>{formatDate(r.createdAt)}</td>
                <td>
                  {t.admin.regStatus[r.status]}
                  {r.submitCount > 1 && ` ×${r.submitCount}`}
                  {r.confirmedAt && ` · ${t.admin.confirmedAtLabel} ${formatDate(r.confirmedAt)}`}
                  {r.alreadyEnrolled && r.status !== 'ENROLLED' && ` · ${t.admin.alreadyEnrolled}`}
                </td>
                <td>
                  {r.status !== 'ENROLLED' && (
                    <GrantForm registrationId={r.id} canGrant={r.status !== 'PENDING_OPT_IN'} />
                  )}
                  {/* ADM-13/D-050: удалить заявку-лид (и связанную учётку, если доступ уже выдан) */}
                  <DeleteParticipant refType="registration" id={r.id} email={r.email} successTo="/admin" errorTo="/admin" />
                </td>
              </tr>
            ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  )
}
