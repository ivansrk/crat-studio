import { describe, it, expect } from 'vitest'
import {
  getCourses, getCourse, getLesson, contentErrors, nextLessonId, prevLessonId, lessonPosition, lessonCount,
  assetBase, getArticles, getArticle, articleIssues, lessonExcerpt,
  splitCourseCatalog, soleCourseRedirect,
} from './index'

describe('реестр курсов (MC-01/02/08)', () => {
  it('getCourses() возвращает все курсы, включая неопубликованные', () => {
    const slugs = getCourses().map(c => c.slug)
    expect(slugs).toContain('ai-basics')
    expect(slugs).toContain('demo-course')
  })
  it('getCourses() отсортирован стабильно по slug', () => {
    const slugs = getCourses().map(c => c.slug)
    expect(slugs).toEqual([...slugs].sort())
  })
  it('ai-basics опубликован (поле published отсутствует в course.yaml → true)', () => {
    expect(getCourse('ai-basics')?.published).toBe(true)
  })
  it('demo-course НЕ опубликован (published: false в course.yaml)', () => {
    expect(getCourse('demo-course')?.published).toBe(false)
  })
  it('getCourse — null для несуществующего slug', () => {
    expect(getCourse('нет')).toBeNull()
  })
})

describe('контент репозитория (курс ai-basics)', () => {
  it('12 уроков из content/ai-basics валидны', () => {
    expect(contentErrors()).toEqual([])
    expect(getCourse('ai-basics')?.lessons.size).toBe(12)
  })
  it('lessonCount("ai-basics") — 12 по course.yaml (знаменатель прогресса, D-029)', () => {
    expect(lessonCount('ai-basics')).toBe(12)
  })
  it('getCourse() кэширует результат на процесс', () => {
    expect(getCourse('ai-basics')).toBe(getCourse('ai-basics'))
  })
})

describe('демо-курс (content/demo-course, витрина реестра)', () => {
  it('lessonCount("demo-course") — 1', () => {
    expect(lessonCount('demo-course')).toBe(1)
  })
  it('уроки с одинаковым lessonId в разных курсах не путаются (E-MC2)', () => {
    const demo = getLesson('demo-course', '1.1')
    const basics = getLesson('ai-basics', '1.1')
    expect(demo).not.toBeNull()
    expect(basics).not.toBeNull()
    expect(demo).not.toBe(basics)
    expect(demo?.meta.title).not.toBe(basics?.meta.title)
  })
  it('assetBase учитывает courseSlug первым параметром', () => {
    const demo = getLesson('demo-course', '1.1')!
    const basics = getLesson('ai-basics', '1.1')!
    expect(assetBase('demo-course', demo)).toBe('/content-assets/demo-course/module-1/lesson-1.1')
    expect(assetBase('ai-basics', basics)).toBe('/content-assets/ai-basics/module-1/lesson-1.1')
  })
})

describe('nextLessonId(courseSlug, lessonId)', () => {
  it('следующий урок из середины курса ai-basics', () => {
    expect(nextLessonId('ai-basics', '1.1')).toBe('1.2')
    expect(nextLessonId('ai-basics', '1.3')).toBe('2.1') // переход через модуль
  })
  it('null для последнего урока (4.3) и для неизвестного id', () => {
    expect(nextLessonId('ai-basics', '4.3')).toBeNull()
    expect(nextLessonId('ai-basics', '9.9')).toBeNull()
  })
  it('null для единственного урока демо-курса', () => {
    expect(nextLessonId('demo-course', '1.1')).toBeNull()
  })
})

describe('prevLessonId(courseSlug, lessonId) — T4 дизайн-аудита', () => {
  it('предыдущий урок из середины курса ai-basics', () => {
    expect(prevLessonId('ai-basics', '1.2')).toBe('1.1')
    expect(prevLessonId('ai-basics', '2.1')).toBe('1.3') // переход через модуль назад
  })
  it('null для первого урока (1.1) и для неизвестного id', () => {
    expect(prevLessonId('ai-basics', '1.1')).toBeNull()
    expect(prevLessonId('ai-basics', '9.9')).toBeNull()
  })
  it('null для единственного урока демо-курса', () => {
    expect(prevLessonId('demo-course', '1.1')).toBeNull()
  })
})

describe('lessonPosition(courseSlug, lessonId) — T4 дизайн-аудита', () => {
  it('позиция урока внутри своего модуля', () => {
    expect(lessonPosition('ai-basics', '1.1')).toEqual({ index: 1, total: 3, moduleId: 1 })
    expect(lessonPosition('ai-basics', '2.1')).toEqual({ index: 1, total: 3, moduleId: 2 })
    expect(lessonPosition('ai-basics', '4.3')).toEqual({ index: 3, total: 3, moduleId: 4 })
  })
  it('null для неизвестного курса/урока', () => {
    expect(lessonPosition('ai-basics', '9.9')).toBeNull()
    expect(lessonPosition('unknown', '1.1')).toBeNull()
  })
})

describe('lessonExcerpt(courseSlug, lessonId) — T7 дизайн-аудита («Выдержка из урока»)', () => {
  it('первый содержательный абзац урока 1.1, без заголовка и mdx-компонентов', () => {
    const excerpt = lessonExcerpt('ai-basics', '1.1')
    expect(excerpt).not.toBeNull()
    expect(excerpt!.lessonTitle).toBe(getLesson('ai-basics', '1.1')!.meta.title)
    expect(excerpt!.text).not.toMatch(/^#/)
    expect(excerpt!.text).not.toMatch(/[<>]/)
    expect(excerpt!.text).not.toMatch(/заглушка для разработки/)
    expect(excerpt!.text.startsWith('Когда мы слышим слово')).toBe(true)
  })
  it('null для неизвестного курса/урока', () => {
    expect(lessonExcerpt('unknown', '1.1')).toBeNull()
    expect(lessonExcerpt('ai-basics', '9.9')).toBeNull()
  })
})

describe('splitCourseCatalog (MC-03) — мои курсы vs каталог', () => {
  it('enrolled slug уходит в mine, остальные — в others', () => {
    const { mine, others } = splitCourseCatalog(getCourses(), ['ai-basics'])
    expect(mine.map(c => c.slug)).toEqual(['ai-basics'])
    expect(others.map(c => c.slug)).toEqual(['demo-course'])
  })
  it('без enrollments — mine пуст, others = весь реестр', () => {
    const { mine, others } = splitCourseCatalog(getCourses(), [])
    expect(mine).toEqual([])
    expect(others.map(c => c.slug)).toEqual(getCourses().map(c => c.slug))
  })
  it('мои курсы исключены из каталога даже при нескольких enrollments', () => {
    const { mine, others } = splitCourseCatalog(getCourses(), ['ai-basics', 'demo-course'])
    expect(mine.map(c => c.slug)).toEqual(['ai-basics', 'demo-course'])
    expect(others).toEqual([])
  })
})

describe('soleCourseRedirect — редирект хаба на единственный курс', () => {
  it('один мой курс и пустой каталог остальных → slug этого курса', () => {
    // реестр из одного курса (моделирует единственный курс в проде) — реальные фикстуры дают 2 (MC-08)
    const onlyCourse = getCourses().filter(c => c.slug === 'ai-basics')
    const { mine, others } = splitCourseCatalog(onlyCourse, ['ai-basics'])
    expect(soleCourseRedirect(mine, others)).toBe('ai-basics')
  })
  it('один мой курс, но каталог остальных непуст (demo-course «Скоро») → null (хаб нужен)', () => {
    const { mine, others } = splitCourseCatalog(getCourses(), ['ai-basics'])
    expect(soleCourseRedirect(mine, others)).toBeNull()
  })
  it('нет моих курсов → null', () => {
    const { mine, others } = splitCourseCatalog(getCourses(), [])
    expect(soleCourseRedirect(mine, others)).toBeNull()
  })
})

describe('статьи репозитория валидны (content/articles, Ф6 T2 — 2 заглушки)', () => {
  it('2 статьи валидны, без ошибок', () => {
    expect(getArticles().length).toBe(2)
    expect(articleIssues()).toEqual([])
  })
  it('getArticle(slug) — статья по существующему slug, null для мусора', () => {
    expect(getArticle('kak-nachat-s-ii')?.meta.title).toBe('Как начать пользоваться нейросетями: первые три шага')
    expect(getArticle('nope')).toBeNull()
  })
})
