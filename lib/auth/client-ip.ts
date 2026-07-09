import { headers } from 'next/headers'

/** IP клиента для rate-limit. Rightmost x-forwarded-for = добавлен прокси Render;
 *  клиентская часть заголовка подделываема (спуфинг лимита). */
export async function clientIp(): Promise<string> {
  const h = await headers()
  return (h.get('x-forwarded-for') ?? 'local').split(',').at(-1)!.trim()
}
