'use server'
import { redirect } from 'next/navigation'
import { clientIp } from '@/lib/auth/client-ip'
import { limiters } from '@/lib/auth/rate-limit'
import { submitRegistration } from '@/lib/registration'

/** Куда возвращать при ошибке: белый список против open redirect (SITE-03).
 *  /invite/{token} — переменный сегмент, поэтому проверяется формой (только буквы/цифры
 *  токена — тот же алфавит, что newToken()/hex), а не точным совпадением: это не ослабляет
 *  защиту от open redirect (путь всё равно жёстко ограничен нашим доменом), только позволяет
 *  вернуть на ту самую инвайт-страницу. */
const STATIC_RETURN_TO = ['/ai-basics', '/register'] as const
const INVITE_RETURN_RE = /^\/invite\/[0-9a-fA-F]+$/

function isAllowedReturnTo(raw: string): boolean {
  return (STATIC_RETURN_TO as readonly string[]).includes(raw) || INVITE_RETURN_RE.test(raw)
}

export async function registerAction(formData: FormData) {
  const raw = String(formData.get('returnTo') ?? '')
  const returnTo = isAllowedReturnTo(raw) ? raw : '/ai-basics'
  if (!limiters.registration.allow(`reg:${await clientIp()}`)) redirect(`${returnTo}?signup=rate#signup`) // REG-07, мягко

  const inviteToken = (formData.get('inviteToken') as string) || null
  const result = await submitRegistration({
    firstName: String(formData.get('firstName') ?? ''),
    lastName: String(formData.get('lastName') ?? ''),
    email: String(formData.get('email') ?? ''),
    phone: (formData.get('phone') as string) || null,
    telegram: (formData.get('telegram') as string) || null,
    whatsapp: (formData.get('whatsapp') as string) || null,
    dataConsent: formData.get('dataConsent') === 'on',
    wantsNewsletter: formData.get('wantsNewsletter') === 'on',
    inviteToken,
  })

  // REG-11: успех всегда ведёт на общий экран «Проверьте почту» — та же логика, что раньше
  // вела на общий «Заявка принята», независимо от того, откуда пришла форма (SITE-03).
  if (result === 'pending') redirect('/ai-basics/accepted')
  if (result === 'already') redirect(`${returnTo}?signup=already#signup`) // REG-14/E-INV3
  if (result === 'invite_invalid') redirect(returnTo) // инвайт стал невалиден между открытием и сабмитом — страница сама покажет E-INV1
  redirect(`${returnTo}?signup=invalid#signup`) // 'invalid'
}
