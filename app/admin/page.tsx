import { db } from '@/lib/db'
import { grantAccessAction } from '@/app/actions/admin'
import { t } from '@/lib/i18n'

export const dynamic = 'force-dynamic'
export default async function Registrations({ searchParams }: { searchParams: Promise<{ grant?: string }> }) {
  const { grant } = await searchParams
  const regs = await db.registration.findMany({ orderBy: { updatedAt: 'desc' } })
  return (
    <main className="admin-wide">
      <h1>{t.admin.registrations}</h1>
      {grant === 'email_failed' && <p role="alert" className="form-alert">{t.admin.emailFailed}</p>}
      {regs.length === 0 ? <p>{t.admin.noData}</p> : (
        <table className="admin-table">
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
              <td>{r.status !== 'ENROLLED' && (
                <form action={grantAccessAction}>
                  <input type="hidden" name="registrationId" value={r.id} />
                  <button className="mdx-download" type="submit">{t.admin.grant}</button>
                </form>
              )}</td>
            </tr>
          ))}
          </tbody>
        </table>
      )}
    </main>
  )
}
