import Link from 'next/link'
import { listClients } from '@/lib/crm'
import { DeleteParticipant } from '@/components/admin/DeleteParticipant'
import { DeleteBanner } from '@/components/admin/DeleteBanner'
import { t } from '@/lib/i18n'

export const dynamic = 'force-dynamic'

/** CRM-01/02: список клиентов + поиск. Server component, форма поиска — обычный GET
 *  (?q=…), без клиентского JS — тот же принцип, что у остальной админки. */
export default async function Clients({ searchParams }: { searchParams: Promise<{ q?: string; del?: string }> }) {
  const { q, del } = await searchParams
  const clients = await listClients(q)
  const tc = t.admin.clients

  return (
    <main className="admin-wide">
      <h1>{tc.title}</h1>
      <DeleteBanner del={del} />

      <form method="get" className="admin-search">
        <label htmlFor="q">{tc.searchLabel}</label>
        <input id="q" name="q" defaultValue={q ?? ''} placeholder={tc.searchPlaceholder} />
        <button className="crat-button compact" type="submit">{tc.searchButton}</button>
      </form>

      <p className="crat-muted">{tc.countPrefix} {clients.length}</p>

      {clients.length === 0 ? (
        <p>{q ? tc.noResults : tc.noClients}</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
            <tr>
              <th>{t.admin.colName}</th>
              <th>{t.admin.colEmail}</th>
              <th>{tc.colPhone}</th>
              <th>{tc.colMessengers}</th>
              <th>{tc.colSubscribed}</th>
              <th>{tc.colLastCourse}</th>
              <th>{tc.colCertCount}</th>
              <th></th>
            </tr>
            </thead>
            <tbody>
            {clients.map(c => (
              <tr key={c.id}>
                <td>
                  <Link href={`/admin/clients/${c.id}`}>{c.firstName} {c.lastName}</Link>
                  {c.resendSyncError && <span className="form-alert crm-flag"> {tc.syncErrorFlag}</span>}
                </td>
                <td>{c.email}</td>
                <td>{c.phone ?? t.admin.notYet}</td>
                <td>{[c.telegram, c.whatsapp].filter(Boolean).join(' · ') || t.admin.notYet}</td>
                <td>{c.subscribed ? tc.subscribedYes : tc.subscribedNo}</td>
                <td>{c.lastCourseSlug ?? t.admin.notYet}</td>
                <td>{c.certCount > 0 ? c.certCount : t.admin.notYet}</td>
                <td>
                  <DeleteParticipant refType="user" id={c.id} email={c.email} successTo="/admin/clients" errorTo="/admin/clients" />
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
