'use server'
import { redirect } from 'next/navigation'
import { currentUser } from '@/lib/auth/current-user'
import { hasCourseAccess } from '@/lib/progress/access'
import { askT1 } from '@/lib/trainers/t1'
import { askT2Initial, askT2Refine } from '@/lib/trainers/t2'
import { t } from '@/lib/i18n'

async function requireStudent() {
  const user = await currentUser()
  // Тренажёры прибиты к ai-basics до Ф8 (как в app/app/trainers/) — не курсо-зависимая логика.
  if (!user || !(await hasCourseAccess(user, 'ai-basics'))) redirect('/login')
  return user
}

const REASON_MESSAGE: Record<'daily' | 'minute' | 'error', string> = {
  daily: t.trainers.limitDaily,
  minute: t.trainers.limitMinute,
  error: t.trainers.error,
}

export type T1FormState = { reply?: string; message?: string }

/** TRN-02/05: серверный экшен для T1Form (useActionState) — вызывается ТОЛЬКО после проверки
 *  enrollment (requireStudent), ключ Anthropic наружу не уходит. Возвращает уже готовую
 *  локализованную строку (не ключ словаря) — компонент её просто рендерит. */
export async function askT1Action(_prevState: T1FormState, formData: FormData): Promise<T1FormState> {
  const user = await requireStudent()

  const text = String(formData.get('text') ?? '').trim()
  if (!text) return { message: t.trainers.emptyInput }

  const result = await askT1(user.id, text)
  return result.ok ? { reply: result.reply } : { message: REASON_MESSAGE[result.reason] }
}

/** TRN-08: состояние двух стадий T2 «Дожми ответ» в самом action-state (D-042 — БД диалог не хранит).
 *  stage='first' — есть промпт и первый ответ, форма показывает поле уточнения; stage='refined' —
 *  есть вдобавок уточнение и второй ответ+разбор. prompt/firstAnswer/followUp возвращаются обратно,
 *  чтобы T2Form переносила их hidden-полями на следующий submit (иначе состояние потеряется —
 *  useActionState живёт только на клиенте, а сам вызов идёт через новый POST на сервер). */
export type T2FormState = {
  stage?: 'first' | 'refined'
  prompt?: string
  firstAnswer?: string
  followUp?: string
  refinedAnswer?: string
  message?: string
}

/** TRN-02/05/08: серверный экшен для T2Form. Шаг определяется скрытым полем `step`
 *  ('refine' → второй вызов askT2Refine, иначе — первый askT2Initial). На ошибке лимита/сети
 *  во время уточнения stage откатывается на 'first' с сохранением prompt/firstAnswer — студент
 *  не теряет уже полученный первый ответ и может попробовать уточнить снова. */
export async function askT2Action(_prevState: T2FormState, formData: FormData): Promise<T2FormState> {
  const user = await requireStudent()
  const step = String(formData.get('step') ?? 'first')

  if (step === 'refine') {
    const prompt = String(formData.get('prompt') ?? '')
    const firstAnswer = String(formData.get('firstAnswer') ?? '')
    const followUp = String(formData.get('followUp') ?? '').trim()
    // Defensive: hidden-поля отсутствуют — форма пришла в непредвиденном состоянии, начинаем сначала.
    if (!prompt || !firstAnswer) return { message: t.trainers.error }
    if (!followUp) return { stage: 'first', prompt, firstAnswer, message: t.trainers.t2EmptyFollowUp }

    const result = await askT2Refine(user.id, prompt, firstAnswer, followUp)
    if (!result.ok) return { stage: 'first', prompt, firstAnswer, message: REASON_MESSAGE[result.reason] }
    return { stage: 'refined', prompt, firstAnswer, followUp, refinedAnswer: result.reply }
  }

  const prompt = String(formData.get('prompt') ?? '').trim()
  if (!prompt) return { message: t.trainers.emptyInput }

  const result = await askT2Initial(user.id, prompt)
  if (!result.ok) return { message: REASON_MESSAGE[result.reason] }
  return { stage: 'first', prompt, firstAnswer: result.reply }
}
