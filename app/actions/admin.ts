'use server'
import { revalidatePath } from 'next/cache'
import { notFound, redirect } from 'next/navigation'
import { currentUser, isAdminEmail } from '@/lib/auth/current-user'
import { grantAccess } from '@/lib/admin/grant-access'

async function requireAdmin() {
  const user = await currentUser()
  if (!user || !isAdminEmail(user.email)) notFound() // ADM-01: та же 404, что и layout — прямой POST не раскрывает существование эндпоинта
  return user
}

export async function grantAccessAction(formData: FormData) {
  const admin = await requireAdmin()
  const result = await grantAccess(String(formData.get('registrationId')), admin.id)
  revalidatePath('/admin')
  // Нота ревью T4/T9: доступ выдан, но запись письма не создалась — отдельный баннер, а не тишина.
  if (result === 'granted_email_failed') redirect('/admin?grant=email_failed')
  if (result === 'already') redirect('/admin?grant=already') // ADM-04: объясняем, почему письма не будет
}

export async function resendEmailAction(formData: FormData) {
  await requireAdmin()
  const { resendFromLog } = await import('@/lib/admin/resend-email')
  const result = await resendFromLog(String(formData.get('emailLogId')))
  revalidatePath('/admin/emails')
  if (result === 'user_gone') redirect('/admin/emails?resend=user_gone') // GDPR-удалённый адресат (D-028)
  if (result === 'sent') redirect('/admin/emails?resend=ok')
}
