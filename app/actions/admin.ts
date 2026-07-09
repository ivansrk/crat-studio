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

// T5 (AUTH-15): состояние useActionState вместо redirect — пароль должен показаться на экране
// РОВНО один раз и не пережить перезагрузку/навигацию (нельзя положить в query-string/cookie/БД).
// GrantForm.tsx (client) держит это состояние только в памяти React.
export type GrantActionState =
  | { status: 'idle' }
  | { status: 'granted'; plainPassword: string | null; email: string }
  | { status: 'granted_email_failed'; plainPassword: string | null; email: string }
  | { status: 'already' }

export async function grantAccessAction(_prevState: GrantActionState, formData: FormData): Promise<GrantActionState> {
  const admin = await requireAdmin()
  const result = await grantAccess(String(formData.get('registrationId')), admin.id)
  revalidatePath('/admin')
  if (result.status === 'not_found') return { status: 'idle' }
  return result
}

export async function resendEmailAction(formData: FormData) {
  await requireAdmin()
  const { resendFromLog } = await import('@/lib/admin/resend-email')
  const result = await resendFromLog(String(formData.get('emailLogId')))
  revalidatePath('/admin/emails')
  if (result === 'user_gone') redirect('/admin/emails?resend=user_gone') // GDPR-удалённый адресат (D-028)
  if (result === 'unsupported_type') redirect('/admin/emails?resend=unsupported')
  if (result === 'cert_gone') redirect('/admin/emails?resend=cert_gone') // CERT-05: сертификат отозван/не найден
  if (result === 'send_failed') redirect('/admin/emails?resend=send_failed') // рендер PDF/письма упал (ревью T3)
  if (result === 'sent') redirect('/admin/emails?resend=ok')
}

export async function reviewProjectAction(formData: FormData) {
  const admin = await requireAdmin()
  const { reviewProject } = await import('@/lib/admin/review-project')
  const verdict = formData.get('verdict') === 'approve' ? 'approve' : 'needs_changes' // две кнопки name="verdict"
  const result = await reviewProject(
    String(formData.get('submissionId')),
    verdict,
    String(formData.get('comment') ?? ''),
    String(formData.get('seenUpdatedAt')),
    admin.id,
  )
  revalidatePath('/admin/projects')
  redirect(`/admin/projects?review=${result}`)
}

export async function gdprDeleteAction(formData: FormData) {
  await requireAdmin()
  const { gdprDeleteStudent } = await import('@/lib/admin/gdpr')
  const result = await gdprDeleteStudent(String(formData.get('userId')), String(formData.get('confirmEmail')))
  revalidatePath('/admin/students')
  // Ревью: удаление НЕОБРАТИМО — молчаливый no-op при несовпадении email недопустим, админ должен
  // увидеть явный результат в обоих случаях, а не гадать, сработала ли форма.
  if (result === 'email_mismatch') redirect('/admin/students?gdpr=mismatch')
  if (result === 'deleted') redirect('/admin/students?gdpr=deleted')
}
