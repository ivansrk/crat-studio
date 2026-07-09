'use server'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { limiters } from '@/lib/auth/rate-limit'
import { requestMagicLink } from '@/lib/auth/magic-link'

export async function requestLinkAction(formData: FormData) {
  const h = await headers()
  // rightmost = добавлен прокси Render; клиентская часть заголовка подделываема (спуфинг лимита)
  const ip = (h.get('x-forwarded-for') ?? 'local').split(',').at(-1)!.trim()
  // SEC-03: 10/15мин/IP против перебора email; при отказе письмо не шлём, но ответ тот же (SEC-06)
  if (limiters.magicLinkIp.allow(`mlip:${ip}`)) {
    await requestMagicLink(String(formData.get('email') ?? ''))
  }
  redirect('/login/sent') // AUTH-02: ответ всегда одинаковый
}
