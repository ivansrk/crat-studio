import { db } from '@/lib/db'

export const DAILY_LIMIT = 20 // TRN-03, день по Europe/Warsaw
export const MINUTE_LIMIT = 3

const TZ = 'Europe/Warsaw'
const dateFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
const hourFmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hourCycle: 'h23' })

/** Начало текущего дня по Warsaw в UTC-timestamp.
 *  Warsaw — CET (UTC+1) зимой и CEST (UTC+2) летом, полночь местного дня — это 23:00 или 22:00 UTC
 *  предыдущей даты. Прямого API у Intl нет, поэтому берём обе кандидатуры (CET/CEST) на предыдущую
 *  UTC-дату и выбираем ту, что действительно форматируется в Warsaw как 00:xx нужной даты
 *  (переход DST в Европе происходит ночью, не на границе суток — кандидаты не пересекаются). */
export function warsawDayStart(now: Date): Date {
  const dateStr = dateFmt.format(now) // 'YYYY-MM-DD' в Warsaw

  const prevDate = new Date(`${dateStr}T00:00:00Z`)
  prevDate.setUTCDate(prevDate.getUTCDate() - 1)
  const prevDateStr = prevDate.toISOString().slice(0, 10)

  const candidates = [
    new Date(`${prevDateStr}T22:00:00Z`), // CEST (UTC+2)
    new Date(`${prevDateStr}T23:00:00Z`), // CET (UTC+1)
  ]
  const match = candidates.find(c => dateFmt.format(c) === dateStr && hourFmt.format(c) === '00')
  if (!match) throw new Error(`warsawDayStart: не удалось определить начало Warsaw-дня для ${now.toISOString()}`)
  return match
}

/** Чистая проверка окон использования тренажёра (TRN-03): usedAtList — прошлые обращения того же
 *  пользователя/тренажёра, now — момент новой попытки. Дневное окно — Warsaw-день (см. warsawDayStart),
 *  минутное — (now − 60с, now] (граница в 60с исключена). */
export function checkWindows(usedAtList: Date[], now: Date): 'ok' | 'daily' | 'minute' {
  const dayStart = warsawDayStart(now)
  const dailyCount = usedAtList.filter(d => d.getTime() >= dayStart.getTime() && d.getTime() <= now.getTime()).length
  if (dailyCount >= DAILY_LIMIT) return 'daily'

  const minuteStart = now.getTime() - 60_000
  const minuteCount = usedAtList.filter(d => d.getTime() > minuteStart && d.getTime() <= now.getTime()).length
  if (minuteCount >= MINUTE_LIMIT) return 'minute'

  return 'ok'
}

/** TRN-03/D-015: лимиты — в БД (деньги API). Читает использования тренажёра пользователем за текущий
 *  Warsaw-день, прогоняет через checkWindows и при 'ok' создаёт запись.
 *  Гонка двух параллельных запросов у самой границы лимита теоретически может дать 21-ю запись
 *  за день (не транзакционим read+create) — приемлемо для anti-abuse лимита, это не платёжная логика. */
export async function tryConsume(userId: string, trainerId: string): Promise<'ok' | 'daily' | 'minute'> {
  const now = new Date()
  const dayStart = warsawDayStart(now)
  const usages = await db.trainerUsage.findMany({
    where: { userId, trainerId, usedAt: { gte: dayStart } },
    select: { usedAt: true },
  })
  const result = checkWindows(usages.map(u => u.usedAt), now)
  if (result === 'ok') {
    await db.trainerUsage.create({ data: { userId, trainerId, usedAt: now } })
  }
  return result
}
