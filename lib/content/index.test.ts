import { describe, it, expect } from 'vitest'
import { getContent, contentErrors, nextLessonId, lessonCount, getArticles, getArticle, articleIssues } from './index'

describe('контент репозитория', () => {
  it('12 уроков из content/ai-basics валидны', () => {
    expect(contentErrors()).toEqual([])
    expect(getContent().lessons.size).toBe(12)
  })
  it('lessonCount — 12 по course.yaml (знаменатель прогресса, D-029)', () => {
    expect(lessonCount()).toBe(12)
  })
  it('getContent кэширует результат на процесс', () => {
    expect(getContent()).toBe(getContent())
  })
})

describe('nextLessonId', () => {
  it('следующий урок из середины курса', () => {
    expect(nextLessonId('1.1')).toBe('1.2')
    expect(nextLessonId('1.3')).toBe('2.1') // переход через модуль
  })
  it('null для последнего урока (4.3) и для неизвестного id', () => {
    expect(nextLessonId('4.3')).toBeNull()
    expect(nextLessonId('9.9')).toBeNull()
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
