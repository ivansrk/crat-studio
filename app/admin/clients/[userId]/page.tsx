import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getClient } from '@/lib/crm'
import { updateClientAction, resyncClientAction } from '@/app/actions/crm'
import { formatDate } from '@/lib/i18n/format-date'
import { t } from '@/lib/i18n'

export const dynamic = 'force-dynamic'

const UPDATE_BANNER: Record<string, { text: string; alert: boolean }> = {
  ok: { text: t.admin.clients.savedOk, alert: false },
  invalid_firstName: { text: t.admin.clients.invalidFirstName, alert: true },
  invalid_lastName: { text: t.admin.clients.invalidLastName, alert: true },
  invalid_phone: { text: t.admin.clients.invalidPhone, alert: true },
}

const RESYNC_BANNER: Record<string, { text: string; alert: boolean }> = {
  synced: { text: t.admin.clients.resyncSynced, alert: false },
  skipped: { text: t.admin.clients.resyncSkipped, alert: false },
  error: { text: t.admin.clients.resyncError, alert: true },
}

/** CRM-03: карточка клиента — профиль+редактирование, заявка, журнал согласий, курсы, сертификат.
 *  Ссылка на прогресс по урокам ведёт на существующую /admin/students/[userId] (не дублируем). */
export default async function ClientCard({
  params, searchParams,
}: {
  params: Promise<{ userId: string }>
  searchParams: Promise<{ updated?: string; resync?: string }>
}) {
  const { userId } = await params
  const { updated, resync } = await searchParams
  const detail = await getClient(userId)
  if (!detail) notFound()
  const { user, registration, consents, enrollments, certificates, consultations, subscribed } = detail
  const tc = t.admin.clients

  const updateBanner = updated ? UPDATE_BANNER[updated] : undefined
  const resyncBanner = resync ? RESYNC_BANNER[resync] : undefined

  return (
    <main className="admin-wide">
      <p><Link href="/admin/clients">{tc.backToList}</Link></p>
      <h1>{user.firstName} {user.lastName}</h1>
      <p className="crat-muted">
        {tc.subscriptionLabel}: {subscribed ? tc.subscriptionYes : tc.subscriptionNo}
        {user.resendSyncError && <span className="form-alert crm-flag"> · {tc.syncErrorFlag}</span>}
      </p>

      {user.resendSyncError && <p role="alert" className="form-alert">{tc.syncErrorBanner}</p>}
      {updateBanner && (
        <p role={updateBanner.alert ? 'alert' : undefined} className={updateBanner.alert ? 'form-alert' : 'crat-muted'}>
          {updateBanner.text}
        </p>
      )}
      {resyncBanner && (
        <p role={resyncBanner.alert ? 'alert' : undefined} className={resyncBanner.alert ? 'form-alert' : 'crat-muted'}>
          {resyncBanner.text}
        </p>
      )}

      <h2>{tc.sectionEdit}</h2>
      <form action={updateClientAction} className="admin-edit-form crat-card">
        <input type="hidden" name="userId" value={user.id} />
        <label>
          {tc.fieldEmail}
          <input value={user.email} readOnly disabled />
        </label>
        <p className="crat-muted">{tc.emailReadonlyNote}</p>
        <label>
          {tc.fieldFirstName}
          <input name="firstName" defaultValue={user.firstName} required />
        </label>
        <label>
          {tc.fieldLastName}
          <input name="lastName" defaultValue={user.lastName} required />
        </label>
        <label>
          {tc.fieldPhone}
          <input name="phone" type="tel" defaultValue={user.phone ?? ''} />
        </label>
        <label>
          {tc.fieldTelegram}
          <input name="telegram" defaultValue={user.telegram ?? ''} />
        </label>
        <label>
          {tc.fieldWhatsapp}
          <input name="whatsapp" defaultValue={user.whatsapp ?? ''} />
        </label>
        <button className="crat-button primary" type="submit">{tc.save}</button>
      </form>

      <form action={resyncClientAction}>
        <input type="hidden" name="userId" value={user.id} />
        <button className="crat-button compact" type="submit">{tc.resyncButton}</button>
      </form>

      <h2>{tc.sectionHistory}</h2>

      <h3>{tc.registrationSection}</h3>
      {registration ? (
        <p>{t.admin.regStatus[registration.status]} · {formatDate(registration.createdAt)}</p>
      ) : <p className="crat-muted">{tc.noRegistration}</p>}

      <h3>{tc.consentsSection}</h3>
      {consents.length === 0 ? <p className="crat-muted">{tc.noConsents}</p> : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
            <tr>
              <th>{tc.colConsentType}</th>
              <th>{tc.colConsentGranted}</th>
              <th>{tc.colConsentSource}</th>
              <th>{tc.colConsentDate}</th>
            </tr>
            </thead>
            <tbody>
            {consents.map(c => (
              <tr key={c.id}>
                <td>{tc.consentType[c.type]}</td>
                <td>{c.granted ? tc.consentGranted : tc.consentRevoked}</td>
                <td>{tc.consentSource[c.source]}</td>
                <td>{formatDate(c.createdAt)}</td>
              </tr>
            ))}
            </tbody>
          </table>
        </div>
      )}

      <h3>{tc.coursesSection}</h3>
      {enrollments.length === 0 ? <p className="crat-muted">{tc.noCourses}</p> : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
            <tr>
              <th>{tc.colCourseSlug}</th>
              <th>{tc.colCourseSource}</th>
              <th>{tc.colCourseDate}</th>
            </tr>
            </thead>
            <tbody>
            {enrollments.map(e => (
              <tr key={e.id}>
                <td>{e.courseSlug}</td>
                <td>{e.source}</td>
                <td>{formatDate(e.createdAt)}</td>
              </tr>
            ))}
            </tbody>
          </table>
        </div>
      )}
      <p><Link className="crat-button compact" href={`/admin/students/${user.id}`}>{t.admin.progress}</Link></p>

      <h3>{tc.certificateSection}</h3>
      {certificates.length === 0 ? <p className="crat-muted">{tc.noCertificates}</p> : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
            <tr>
              <th>{tc.colCertNumber}</th>
              <th>{tc.colCertCourse}</th>
              <th>{tc.colCertDate}</th>
              <th>{tc.colCertStatus}</th>
              <th></th>
            </tr>
            </thead>
            <tbody>
            {certificates.map(cert => (
              <tr key={cert.id}>
                <td><Link href={`/cert/${cert.number}`} className="cert-number-mono">{cert.number}</Link></td>
                <td>{cert.courseTitle}</td>
                <td>{formatDate(cert.issuedAt)}</td>
                <td>{cert.status === 'VALID' ? t.admin.certStatusValid : t.admin.certStatusRevoked}</td>
                <td>
                  {cert.status === 'VALID' && (
                    <a className="crat-button compact" href={`/admin/certificates/${cert.id}`} target="_blank" rel="noopener noreferrer">
                      {tc.downloadCertPdf}
                    </a>
                  )}
                </td>
              </tr>
            ))}
            </tbody>
          </table>
        </div>
      )}

      {/* T8 дизайн-аудита (П3): заявки на консультацию этого клиента — видны прямо в карточке,
          не нужно искать по имени/контакту в общем списке /admin/consultations. */}
      <h3>{tc.consultationsSection}</h3>
      {consultations.length === 0 ? <p className="crat-muted">{tc.noConsultations}</p> : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
            <tr>
              <th>{t.admin.colDate}</th>
              <th>{t.admin.consultations.colTopic}</th>
              <th>{t.admin.colStatus}</th>
            </tr>
            </thead>
            <tbody>
            {consultations.map(c => (
              <tr key={c.id}>
                <td>{formatDate(c.createdAt)}</td>
                <td>{c.topic ? (t.consult.topicOptions[c.topic as keyof typeof t.consult.topicOptions] ?? c.topic) : t.admin.notYet}</td>
                <td>{t.admin.consultations.statusLabel[c.status]}</td>
              </tr>
            ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  )
}
