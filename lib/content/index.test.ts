import { describe, it, expect } from 'vitest'
import {
  getCourses, getCourse, getLesson, contentErrors, nextLessonId, lessonCount,
  assetBase, getArticles, getArticle, articleIssues,
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
