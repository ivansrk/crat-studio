'use server'
import { revalidatePath } from 'next/cache'
import { notFound, redirect } from 'next/navigation'
import { clientIp } from '@/lib/auth/client-ip'
import { currentUser, isAdminEmail } from '@/lib/auth/current-user'
import { createConsultation, updateConsultationStatus } from '@/lib/consultation'
import type { ConsultationStatus } from '@/lib/generated/prisma/client'

// Ф7б Task 8, CONS-01…06: форма /consult (публично и из кабинета, MC-03) + смена статуса в админке.

async function requireAdmin() {
  const user = await currentUser()
  if (!user || !isAdminEmail(user.email)) notFound() // ADM-01, тот же паттерн, что app/actions/crm.ts
  return user
}

/** CONS-02/05: rate-limit и валидация — внутри createConsultation (lib/consultation), не здесь. */
export async function consultAction(formData: FormData) {
  const user = await currentUser() // страница публична — сессия может отсутствовать
  const result = await createConsultation(
    {
      name: String(formData.get('name') ?? ''),
      contact: String(formData.get('contact') ?? ''),
      message: String(formData.get('message') ?? ''),
      topic: (formData.get('topic') as string) || null,
    },
    user?.id ?? null,
    await clientIp(),
  )

  if (result === 'accepted') redirect('/consult/accepted')
  redirect(`/consult?sent=${result}`) // 'invalid' | 'rate' — баннер на форме (E-CONS1)
}

// CONS-04: та же логика баннера redirect+query, что updateClientAction/resyncClientAction (app/actions/crm.ts).
export async function updateConsultationStatusAction(formData: FormData) {
  await requireAdmin()
  const id = String(formData.get('id'))
  const status = String(formData.get('status')) as ConsultationStatus
  const result = await updateConsultationStatus(id, status)
  if (result === 'not_found') notFound()
  revalidatePath('/admin/consultations')
  redirect('/admin/consultations?updated=ok')
}
