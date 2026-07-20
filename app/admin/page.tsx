import Link from 'next/link'
import { db } from '@/lib/db'
import { GrantForm } from './GrantForm'
import { DeleteParticipant } from '@/components/admin/DeleteParticipant'
import { DeleteBanner } from '@/components/admin/DeleteBanner'
import { resendOptInAction } from '@/app/actions/admin'
import { t } from '@/lib/i18n'
import { formatDate } from '@/lib/i18n/format-date'

export const dynamic = 'force-dynamic'

/** ADM-14 (D-053): банер результата переотправки double opt-in (?optin=…). */
function OptInBanner({ optin }: { optin?: string }) {
  if (optin === 'sent') return <p className="crat-muted">{t.admin.optInResent}</p>
  if (optin === 'not_found' || optin === 'not_pending') return <p role="alert" className="form-alert">{t.admin.optInResendStale}</p>
  return null
}

export default async function Registrations({ searchParams }: { searchParams: Promise<{ del?: string; optin?: string; rid?: string }> }) {
  const { del, optin, rid } = await searchParams
  const regs = await db.registration.findMany({ orderBy: { updatedAt: 'desc' } })
  // A2 (навигация-связки): у заявки email === ключ учётки — если User с этим email есть,
  // показываем тихий переход в карточку клиента. Один batch-запрос, Map email→userId.
  const regUsers = regs.length === 0 ? [] : await db.user.findMany({
    where: { email: { in: regs.map(r => r.email) } },
    select: { id: true, email: true },
  })
  const userIdByEmail = new Map(regUsers.map(u => [u.email, u.id]))
  return (
    <main className="admin-wide">
      <h1>{t.admin.registrations}</h1>
      <DeleteBanner del={del} />
      <OptInBanner optin={optin} />
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
                <td>
                  {r.firstName} {r.lastName}
                  {userIdByEmail.has(r.email) && (
                    <> <Link className="admin-client-link" href={`/admin/clients/${userIdByEmail.get(r.email)}`}>{t.admin.clientLinkLabel}</Link></>
                  )}
                </td>
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
                  {/* ADM-14 (D-053): застрявшим в PENDING_OPT_IN — новое письмо-подтверждение (свежий токен, 72 ч).
                      Пометка «отправлено» — у конкретной строки (rid): верхний баннер в длинной таблице не видно. */}
                  {r.status === 'PENDING_OPT_IN' && (
                    <form action={resendOptInAction}>
                      <input type="hidden" name="registrationId" value={r.id} />
                      <button className="crat-button compact" type="submit">{t.admin.resendOptIn}</button>
                      {optin === 'sent' && rid === r.id && <p className="crat-muted">{t.admin.optInSentInline}</p>}
                    </form>
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
