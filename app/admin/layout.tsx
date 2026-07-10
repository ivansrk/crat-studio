import { notFound } from 'next/navigation'
import { currentUser, isAdminEmail } from '@/lib/auth/current-user'
import { db } from '@/lib/db'
import { logoutAction } from '@/app/actions/logout'
import { t } from '@/lib/i18n'
import { NavLink } from '@/components/site/NavLink'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser()
  if (!user || !isAdminEmail(user.email)) notFound() // ADM-01 + AUTH-10 (по env, на каждый запрос)
  // T8 дизайн-аудита (П4): дешёвые count() для дашборд-счётчиков в nav (индексы уже есть:
  // ConsultationRequest[status, createdAt], EmailLog/Submission — status).
  // «Заявки» — статусы, где ЖДЁТ действия админ (можно нажать «Выдать доступ»): NEW/RESUBMITTED
  // (легаси-заявки без double opt-in — тот же смысл, что NEW) и CONFIRMED; PENDING_OPT_IN
  // ждёт студента (кнопка выдачи disabled, см. GrantForm canGrant), ENROLLED уже обработана.
  const [newConsultations, pendingRegistrations, submittedProjects] = await Promise.all([
    db.consultationRequest.count({ where: { status: 'NEW' } }),
    db.registration.count({ where: { status: { in: ['NEW', 'RESUBMITTED', 'CONFIRMED'] } } }),
    db.submission.count({ where: { status: 'SUBMITTED' } }),
  ])
  return (
    <>
      <nav className="admin-nav crat-nav" aria-label={t.admin.navAria}>
        <NavLink href="/admin">{t.admin.registrations}{pendingRegistrations > 0 && ` (${pendingRegistrations})`}</NavLink>
        <NavLink href="/admin/students">{t.admin.students}</NavLink>
        <NavLink href="/admin/clients">{t.admin.clients.navLabel}</NavLink>
        <NavLink href="/admin/projects">{t.admin.projects}{submittedProjects > 0 && ` (${submittedProjects})`}</NavLink>
        <NavLink href="/admin/consultations">{t.admin.consultations.navLabel}{newConsultations > 0 && ` (${newConsultations})`}</NavLink>
        <NavLink href="/admin/emails">{t.admin.emails}</NavLink>
        <form action={logoutAction} className="admin-nav-logout">
          <button type="submit" className="reveal-line">{t.auth.logout}</button>
        </form>
      </nav>
      {children}
    </>
  )
}
