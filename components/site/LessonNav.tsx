import Link from 'next/link'
import { t } from '@/lib/i18n'

/** S1 (аудит навигации 2026-07-16, D-051): меню уроков на странице урока.
 *  Презентационный серверный компонент, без клиентского JS — сворачивание рейла
 *  сделано чекбокс-хаком, мобильный дисклоужер — нативным <details> (оба no-JS-friendly,
 *  prefers-reduced-motion уже глушится глобально). Данные (модули/уроки/пройден) считаются
 *  в page.tsx из course.yaml + прогресса (lib/progress), сюда приходят готовым списком. */

export type RailLesson = { id: string; title: string; passed: boolean; current: boolean }
export type RailModule = { id: number; title: string; lessons: RailLesson[] }

function RailList({ modules, courseSlug }: { modules: RailModule[]; courseSlug: string }) {
  return (
    <ol className="lesson-rail-modules">
      {modules.map(m => (
        <li key={m.id} className="lesson-rail-module">
          <p className="lesson-rail-module-title crat-kicker">{m.title}</p>
          <ol className="lesson-rail-lessons">
            {m.lessons.map(l => (
              <li key={l.id}>
                <Link
                  href={`/app/${courseSlug}/lessons/${l.id}`}
                  className={`lesson-rail-link${l.current ? ' is-current' : ''}${l.passed ? ' is-passed' : ''}`}
                  aria-current={l.current ? 'page' : undefined}
                >
                  <span className="lesson-rail-mark" aria-hidden>{l.passed ? '✓' : ''}</span>
                  <span className="lesson-rail-id">{l.id}</span>
                  <span className="lesson-rail-title">{l.title}</span>
                  {l.passed && <span className="crat-visually-hidden"> — {t.cabinet.statusDone}</span>}
                </Link>
              </li>
            ))}
          </ol>
        </li>
      ))}
    </ol>
  )
}

export function LessonNav({
  courseSlug,
  modules,
  globalIndex,
  globalTotal,
  prevId,
  nextId,
}: {
  courseSlug: string
  modules: RailModule[]
  globalIndex: number
  globalTotal: number
  prevId: string | null
  nextId: string | null
}) {
  const miniContext = t.lesson.miniContext
    .replace('{n}', String(globalIndex))
    .replace('{total}', String(globalTotal))

  return (
    <>
      {/* Мобайл (<1024): компактная липкая подшапка урока — мини-контекст, компактные
          prev/next (S9: не мотать до пейджера) и дисклоужер «Уроки» с тем же списком. */}
      <div className="lesson-subbar">
        <p className="lesson-subbar-context crat-kicker">{miniContext}</p>
        <div className="lesson-subbar-actions">
          {prevId ? (
            <Link className="lesson-subbar-nav" href={`/app/${courseSlug}/lessons/${prevId}`} aria-label={t.lesson.prevAria}>
              <span aria-hidden>←</span>
            </Link>
          ) : (
            <span className="lesson-subbar-nav is-disabled" aria-hidden>←</span>
          )}
          {nextId ? (
            <Link className="lesson-subbar-nav" href={`/app/${courseSlug}/lessons/${nextId}`} aria-label={t.lesson.nextAria}>
              <span aria-hidden>→</span>
            </Link>
          ) : (
            <span className="lesson-subbar-nav is-disabled" aria-hidden>→</span>
          )}
          <details className="lesson-subbar-menu">
            <summary className="lesson-subbar-summary">
              <span>{t.lesson.menuLabel}</span>
              <span className="lesson-subbar-caret" aria-hidden>▾</span>
            </summary>
            <nav className="lesson-subbar-panel" aria-label={t.lesson.railAria}>
              <RailList modules={modules} courseSlug={courseSlug} />
            </nav>
          </details>
        </div>
      </div>

      {/* Десктоп (≥1024): тихий рейл в левом поле страницы. Чекбокс-хак — по умолчанию
          свернут на 1024, развёрнут на ≥1280 (инверсия дефолта через медиазапрос, см.
          cabinet.css). Липкий, внутри скроллится сам, если список длиннее вьюпорта. */}
      <aside className="lesson-rail">
        <input type="checkbox" id="lesson-rail-toggle" className="lesson-rail-toggle-input" />
        <label htmlFor="lesson-rail-toggle" className="lesson-rail-toggle">
          <span className="lesson-rail-toggle-text crat-kicker">{t.lesson.railTitle}</span>
          <span className="lesson-rail-caret" aria-hidden>▾</span>
        </label>
        <nav className="lesson-rail-panel" aria-label={t.lesson.railAria}>
          <RailList modules={modules} courseSlug={courseSlug} />
        </nav>
      </aside>
    </>
  )
}
