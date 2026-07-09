import { notFound } from 'next/navigation'
import Link from 'next/link'
import { currentUser, isAdminEmail } from '@/lib/auth/current-user'
import { t } from '@/lib/i18n'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser()
  if (!user || !isAdminEmail(user.email)) notFound() // ADM-01 + AUTH-10 (по env, на каждый запрос)
  return (
    <>
      <nav className="admin-nav crat-nav">
        <Link href="/admin">{t.admin.registrations}</Link>
        <Link href="/admin/students">{t.admin.students}</Link>
        <Link href="/admin/emails">{t.admin.emails}</Link>
      </nav>
      {children}
    </>
  )
}
