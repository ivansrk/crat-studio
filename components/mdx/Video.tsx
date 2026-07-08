import { t } from '@/lib/i18n'

export function Video({ kinescope }: { kinescope: string }) {
  return (
    <div className="mdx-video">
      <iframe
        src={`https://kinescope.io/embed/${kinescope}`}
        title={t.lesson.videoTitle}
        allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
        allowFullScreen
      />
    </div>
  )
}
