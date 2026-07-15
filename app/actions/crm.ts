'use server'
import { revalidatePath } from 'next/cache'
import { notFound, redirect } from 'next/navigation'
import { currentUser, isAdminEmail } from '@/lib/auth/current-user'
import { updateClient, resyncClient } from '@/lib/crm'

async function requireAdmin() {
  const user = await currentUser()
  if (!user || !isAdminEmail(user.email)) notFound() // ADM-01: та же 404, что в остальных админ-экшенах
  return user
}

// F16/CRM-02/03/05: баннер результата — редирект с ?query= на карточку клиента, тот же паттерн,
// что и у остальных админ-форм (app/actions/admin.ts: deleteParticipantAction/reviewProjectAction),
// а не useActionState — здесь нет секрета, который нельзя пережить перезагрузкой (в отличие от
// пароля в GrantForm), обычный redirect+searchParams проще и достаточен.

export async function updateClientAction(formData: FormData) {
  await requireAdmin()
  const userId = String(formData.get('userId'))
  const result = await updateClient(userId, {
    firstName: String(formData.get('firstName') ?? ''),
    lastName: String(formData.get('lastName') ?? ''),
    phone: (formData.get('phone') as string) || null,
    telegram: (formData.get('telegram') as string) || null,
    whatsapp: (formData.get('whatsapp') as string) || null,
  })
  if (result.status === 'not_found') notFound()
  revalidatePath(`/admin/clients/${userId}`)
  revalidatePath('/admin/clients')
  if (result.status === 'invalid') redirect(`/admin/clients/${userId}?updated=invalid_${result.field}`)
  redirect(`/admin/clients/${userId}?updated=ok`)
}

export async function resyncClientAction(formData: FormData) {
  await requireAdmin()
  const userId = String(formData.get('userId'))
  const result = await resyncClient(userId)
  if (result === 'not_found') notFound()
  revalidatePath(`/admin/clients/${userId}`)
  redirect(`/admin/clients/${userId}?resync=${result}`)
}
