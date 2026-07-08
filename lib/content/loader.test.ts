import { describe, it, expect } from 'vitest'
import path from 'node:path'
import { loadCourse } from './loader'

const fx = (n: string) => path.join(__dirname, 'fixtures', n)

describe('loadCourse', () => {
  it('загружает валидный курс без ошибок', () => {
    const c = loadCourse(fx('valid-course'))
    expect(c.issues.filter(i => i.level === 'error')).toHaveLength(0)
    expect(c.lessons.get('1.1')?.meta.title).toBeTruthy()
  })
  it('битый курс: урок без каталога и квиз ≠3 вопросов — ошибки, не исключения', () => {
    const c = loadCourse(fx('broken'))
    const msgs = c.issues.filter(i => i.level === 'error').map(i => i.message).join('\n')
    expect(msgs).toMatch(/1\.2/)
    expect(msgs).toMatch(/3 вопроса/)
    expect(c.lessons.has('1.1')).toBe(false)
  })
  it('quiz.yaml с questions-не-массивом — error-issue, без исключения', () => {
    const c = loadCourse(fx('quiz-not-array'))
    const msgs = c.issues.filter(i => i.level === 'error').map(i => i.message).join('\n')
    expect(msgs).toMatch(/questions должен быть списком/)
    expect(c.lessons.has('1.1')).toBe(false)
  })
  it('quiz.yaml без ключа questions — error «3 вопроса», урок не в lessons', () => {
    const c = loadCourse(fx('quiz-no-questions'))
    const msgs = c.issues.filter(i => i.level === 'error').map(i => i.message).join('\n')
    expect(msgs).toMatch(/3 вопроса \(0\)/)
    expect(c.lessons.has('1.1')).toBe(false)
  })
  it('несуществующий каталог курса — одна ошибка, пустой курс', () => {
    const c = loadCourse(fx('nope'))
    expect(c.issues[0].level).toBe('error')
    expect(c.lessons.size).toBe(0)
  })
})
