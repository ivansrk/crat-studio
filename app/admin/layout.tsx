import { notFound } from 'next/navigation'
import Link from 'next/link'
import { currentUser, isAdminEmail } from '@/lib/auth/current-user'
import { db } from '@/lib/db'
import { t } from '@/lib/i18n'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser()
  if (!user || !isAdminEmail(user.email)) notFound() // ADM-01 + AUTH-10 (по env, на каждый запрос)
  // Ф7б Task 8: счётчик NEW рядом с пунктом меню — один дешёвый count() (индекс [status, createdAt]).
  const newConsultations = await db.consultationRequest.count({ where: { status: 'NEW' } })
  return (
    <>
      <nav className="admin-nav crat-nav">
        <Link href="/admin">{t.admin.registrations}</Link>
        <Link href="/admin/students">{t.admin.students}</Link>
        <Link href="/admin/clients">{t.admin.clients.navLabel}</Link>
        <Link href="/admin/projects">{t.admin.projects}</Link>
        <Link href="/admin/consultations">{t.admin.consultations.navLabel}{newConsultations > 0 && ` (${newConsultations})`}</Link>
        <Link href="/admin/emails">{t.admin.emails}</Link>
      </nav>
      {children}
    </>
  )
}
