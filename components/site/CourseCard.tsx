import Link from 'next/link'
import Image from 'next/image'
import { t, plural } from '@/lib/i18n'

/**
 * Карточка курса в каталоге секции #course (бриф §7.4).
 * Данные приходят из getCourses() — ни названия, ни цифр в разметке нет.
 *
 * Две формы одного контракта:
 * - featured (первый/главный курс): крупная киноафиша — картинка-протагонист на
 *   весь фон, копия поверх на тёмном скриме (тот же проверенный паттерн, что у
 *   DirectionCard: min-height + рост под контент, НЕ aspect-ratio+overflow, иначе
 *   длинный заголовок обрезается — история дефектов).
 * - compact (остальные курсы): тихая карточка с CSS-кадром (без фото — новый курс
 *   не требует нового ассета, каталог масштабируется данными).
 *
 * Факты (модули/уроки/часы) — числа из данных, слово склоняется под число через
 * plural() (lib/i18n): «4 модуля / 12 уроков / 72 часа», «1 модуль» — корректно для
 * любого курса, а не только для текущих цифр ai-basics.
 */
export function CourseCard({
  href,
  title,
  modules,
  lessons,
  hours,
  featured = false,
  image,
}: {
  href: string
  title: string
  modules: number
  lessons: number
  hours: number
  featured?: boolean
  image?: string
}) {
  const facts = (
    <p className="course-facts">
      <span className="course-fact"><span className="course-fact-num">{modules}</span> {plural(modules, t.home.courseFactModules)}</span>
      <span className="course-fact"><span className="course-fact-num">{lessons}</span> {plural(lessons, t.home.courseFactLessons)}</span>
      <span className="course-fact"><span className="course-fact-num">{hours}</span> {plural(hours, t.home.courseFactHours)}</span>
    </p>
  )

  if (featured) {
    return (
      <article className="crat-card course-poster crat-frame-gradient">
        {image && (
          <Image
            src={image}
            alt=""
            fill
            sizes="(max-width: 860px) 100vw, 55vw"
            className="course-poster-img"
          />
        )}
        <span className="course-poster-scrim" aria-hidden="true" />
        <div className="course-poster-body">
          <h3 className="crat-display">{title}</h3>
          {facts}
          <Link href={href} className="crat-button primary">{t.home.coursesCardCta}</Link>
        </div>
      </article>
    )
  }

  return (
    <article className="crat-card course-card">
      <span className="crat-visual-frame horizon crat-noise course-card-thumb" aria-hidden="true" />
      <div className="course-card-body">
        <h3>{title}</h3>
        {facts}
        <Link href={href} className="crat-button">{t.home.coursesCardCta}</Link>
      </div>
    </article>
  )
}
