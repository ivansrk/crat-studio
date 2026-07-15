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
  | { status: 'not_confirmed' } // Ф7б T5, REG-13: серверная защита — PENDING_OPT_IN не выдаём, даже если кнопка была обойдена

export async function grantAccessAction(_prevState: GrantActionState, formData: FormData): Promise<GrantActionState> {
  const admin = await requireAdmin()
  const result = await grantAccess(String(formData.get('registrationId')), admin.id)
  // Ревью M1/AUTH-15: revalidatePath В ЭТОМ round-trip'е рвал показ пароля — force-dynamic
  // /admin успевал перечитать регистрацию как ENROLLED ДО того, как React отрисовал granted-состояние
  // формы, а условие `r.status !== 'ENROLLED'` в admin/page.tsx размонтирует <GrantForm/>, унося
  // plainPassword (он живёт только в памяти этого клиентского компонента, см. GrantForm.tsx) с собой —
  // ни пароль, ни баннер granted_email_failed админ увидеть не успевал (доказано probe-тестом).
  // Фикс: не резолвим статус страницы синхронно с показом пароля — строка обновится на ENROLLED
  // сама, при следующей навигации (страница force-dynamic, кеш RSC ей не нужен).
  if (result.status !== 'granted' && result.status !== 'granted_email_failed') revalidatePath('/admin')
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

// ADM-13, D-050: единый экшен удаления участника из ЛЮБОГО раздела админки (заявки/студенты/
// клиенты + карточки). Один экшен → одна доменная функция deleteParticipant. Ссылка на участника —
// userId (студент/клиент) ИЛИ registrationId (заявка-лид без учётки); successTo/errorTo задают
// компоненты вызова (успех → список, ошибка → та же страница с банером ?del=<причина>).
export async function deleteParticipantAction(formData: FormData) {
  await requireAdmin()
  const userIdRaw = formData.get('userId')
  const registrationIdRaw = formData.get('registrationId')
  const confirmEmail = String(formData.get('confirmEmail') ?? '')
  const successTo = String(formData.get('successTo') || '/admin/students')
  const errorTo = String(formData.get('errorTo') || successTo)

  const { deleteParticipant } = await import('@/lib/admin/delete-participant')
  const ref = userIdRaw
    ? { userId: String(userIdRaw) }
    : { registrationId: String(registrationIdRaw) }
  const result = await deleteParticipant(ref, confirmEmail)

  // Удаление «везде» — обновляем все разделы, где человек мог отображаться.
  revalidatePath('/admin')
  revalidatePath('/admin/students')
  revalidatePath('/admin/clients')

  const sep = (url: string) => (url.includes('?') ? '&' : '?')
  if (result === 'deleted') redirect(`${successTo}${sep(successTo)}del=deleted`)
  redirect(`${errorTo}${sep(errorTo)}del=${result}`) // email_mismatch / is_admin / not_found
}
