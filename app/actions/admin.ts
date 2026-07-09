'use server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { currentUser, isAdminEmail } from '@/lib/auth/current-user'
import { grantAccess } from '@/lib/admin/grant-access'

async function requireAdmin() {
  const user = await currentUser()
  if (!user || !isAdminEmail(user.email)) throw new Error('forbidden')
  return user
}

export async function grantAccessAction(formData: FormData) {
  const admin = await requireAdmin()
  const result = await grantAccess(String(formData.get('registrationId')), admin.id)
  revalidatePath('/admin')
  // Нота ревью T4: доступ выдан, но письмо не ушло — отдельный баннер, а не тишина.
  if (result === 'granted_email_failed') redirect('/admin?grant=email_failed')
}
