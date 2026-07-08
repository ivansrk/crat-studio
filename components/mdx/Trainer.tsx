import { t } from '@/lib/i18n'

export function Trainer({ id }: { id: string; mode?: 'inline' | 'link' }) {
  return (
    <div className="mdx-trainer-stub">
      🎮 {t.lesson.trainerSoon} ({id})
    </div>
  )
}
