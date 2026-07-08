import { MDXRemote } from 'next-mdx-remote/rsc'
import { getLesson } from '@/lib/content'
import { mdxComponents } from '@/components/mdx'
import { t } from '@/lib/i18n'

export default async function LessonPage({ params }: { params: Promise<{ lessonId: string }> }) {
  const { lessonId } = await params
  const lesson = getLesson(lessonId)
  if (!lesson) return <main><p>{t.lesson.unavailable}</p></main>
  const assetBase = `/content-assets/ai-basics/module-${lesson.moduleId}/lesson-${lesson.meta.id}`
  return (
    <main>
      <h1>{lesson.meta.title}</h1>
      {lesson.meta.video_id
        ? <div className="mdx-video"><iframe src={`https://kinescope.io/embed/${lesson.meta.video_id}`} title={t.lesson.videoTitle} allowFullScreen /></div>
        : <p className="mdx-trainer-stub">{t.lesson.videoSoon}</p>}
      <MDXRemote source={lesson.mdx} components={mdxComponents(assetBase)} />
      {lesson.hasCheatsheet && <p><a className="mdx-download" href={`${assetBase}/cheatsheet.pdf`} download>{t.lesson.downloadCheatsheet}</a></p>}
      <p><button className="mdx-download" disabled>{t.lesson.finishLesson}</button></p>
    </main>
  )
}
