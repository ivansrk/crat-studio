'use server'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { limiters } from '@/lib/auth/rate-limit'
import { submitRegistration } from '@/lib/registration'

/** Куда возвращать при ошибке: белый список против open redirect (SITE-03). */
const RETURN_TO = ['/ai-basics', '/register'] as const

export async function registerAction(formData: FormData) {
  const raw = formData.get('returnTo')
  const returnTo = (RETURN_TO as readonly string[]).includes(String(raw)) ? String(raw) : '/ai-basics'
  const h = await headers()
  // rightmost = добавлен прокси Render; клиентская часть заголовка подделываема (спуфинг лимита)
  const ip = (h.get('x-forwarded-for') ?? 'local').split(',').at(-1)!.trim()
  if (!limiters.registration.allow(`reg:${ip}`)) redirect(`${returnTo}?signup=rate#signup`)   // REG-07, мягко
  const result = await submitRegistration({
    firstName: String(formData.get('firstName') ?? ''),
    lastName: String(formData.get('lastName') ?? ''),
    email: String(formData.get('email') ?? ''),
    phone: (formData.get('phone') as string) || null,
    telegram: (formData.get('telegram') as string) || null,
    dataConsent: formData.get('dataConsent') === 'on',
    newsletterConsent: formData.get('newsletterConsent') === 'on',
  })
  redirect(result === 'accepted' ? '/ai-basics/accepted' : `${returnTo}?signup=invalid#signup`)
}
