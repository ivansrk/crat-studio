import { listConsultations } from '@/lib/consultation'
import { updateConsultationStatusAction } from '@/app/actions/consultation'
import { formatDateTime } from '@/lib/i18n/format-date'
import { t } from '@/lib/i18n'

export const dynamic = 'force-dynamic'

// Ф7б Task 8, CONS-04: NEW → CONTACTED → CLOSED — переключение только вперёд по цепочке,
// та же логика линейного статуса, что RegistrationStatus в app/admin/page.tsx.
const NEXT_STATUS = { NEW: 'CONTACTED', CONTACTED: 'CLOSED' } as const

export default async function Consultations({ searchParams }: { searchParams: Promise<{ updated?: string }> }) {
  const { updated } = await searchParams
  const consultations = await listConsultations()
  const tc = t.admin.consultations

  return (
    <main className="admin-wide">
      <h1>{tc.title}</h1>
      {updated === 'ok' && <p className="crat-muted">{tc.updated}</p>}
      {consultations.length === 0 ? <p>{tc.noData}</p> : (
        <table className="admin-table">
          <thead>
          <tr>
            <th>{t.admin.colDate}</th>
            <th>{t.admin.colName}</th>
            <th>{tc.colContact}</th>
            <th>{tc.colTopic}</th>
            <th>{tc.colMessage}</th>
            <th>{t.admin.colStatus}</th>
            <th>{t.admin.colActions}</th>
          </tr>
          </thead>
          <tbody>
          {consultations.map(c => {
            const next = NEXT_STATUS[c.status as keyof typeof NEXT_STATUS]
            return (
              <tr key={c.id}>
                <td>{formatDateTime(c.createdAt)}</td>
                <td>{c.name}</td>
                <td>{c.contact}</td>
                <td>{c.topic ? (t.consult.topicOptions[c.topic as keyof typeof t.consult.topicOptions] ?? c.topic) : t.admin.notYet}</td>
                <td>{c.message}</td>
                <td>{tc.statusLabel[c.status]}</td>
                <td>
                  {next && (
                    <form action={updateConsultationStatusAction}>
                      <input type="hidden" name="id" value={c.id} />
                      <input type="hidden" name="status" value={next} />
                      <button className="crat-button compact" type="submit">
                        {next === 'CONTACTED' ? tc.markContacted : tc.markClosed}
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            )
          })}
          </tbody>
        </table>
      )}
    </main>
  )
}
