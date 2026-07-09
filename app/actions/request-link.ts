'use server'
import { redirect } from 'next/navigation'
import { requestMagicLink } from '@/lib/auth/magic-link'

export async function requestLinkAction(formData: FormData) {
  await requestMagicLink(String(formData.get('email') ?? ''))
  redirect('/login/sent') // AUTH-02: ответ всегда одинаковый
}
