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
  it('пустой quiz.yaml — error-issue, урок не в lessons, без исключений', () => {
    const c = loadCourse(fx('quiz-empty'))
    const msgs = c.issues.filter(i => i.level === 'error').map(i => i.message).join('\n')
    expect(msgs).toMatch(/quiz\.yaml пуст или не является объектом/)
    expect(c.lessons.has('1.1')).toBe(false)
  })
  it('meta.yaml из одного комментария — error-issue, урок не в lessons', () => {
    const c = loadCourse(fx('meta-comment-only'))
    const msgs = c.issues.filter(i => i.level === 'error').map(i => i.message).join('\n')
    expect(msgs).toMatch(/meta\.yaml пуст или не является объектом/)
    expect(c.lessons.has('1.1')).toBe(false)
  })
  it('несуществующий каталог курса — одна ошибка, пустой курс', () => {
    const c = loadCourse(fx('nope'))
    expect(c.issues[0].level).toBe('error')
    expect(c.lessons.size).toBe(0)
  })
  it('course.yaml = null — error, без исключения, пустой курс', () => {
    const c = loadCourse(fx('null-course'))
    const msgs = c.issues.filter(i => i.level === 'error').map(i => i.message).join('\n')
    expect(msgs).toMatch(/course\.yaml пуст или не является объектом/)
    expect(c.lessons.size).toBe(0)
  })
  it('slug ≠ имени каталога — error', () => {
    const c = loadCourse(fx('wrong-slug'))
    const msgs = c.issues.filter(i => i.level === 'error').map(i => i.message).join('\n')
    expect(msgs).toMatch(/slug "not-the-dir-name" ≠ каталогу "wrong-slug"/)
  })
  it('дубль id урока в course.yaml — error «дубль»', () => {
    const c = loadCourse(fx('bad-lessons'))
    const msgs = c.issues.filter(i => i.level === 'error').map(i => i.message).join('\n')
    expect(msgs).toMatch(/дубль id урока 1\.1/)
  })
  it('meta.id ≠ id каталога — error, урок не в lessons', () => {
    const c = loadCourse(fx('bad-lessons'))
    const msgs = c.issues.filter(i => i.level === 'error').map(i => i.message).join('\n')
    expect(msgs).toMatch(/meta\.id "9\.9" ≠ id урока "1\.1"/)
    expect(c.lessons.has('1.1')).toBe(false)
  })
  it('cheatsheet: true без cheatsheet.pdf — error, урок не в lessons', () => {
    const c = loadCourse(fx('bad-lessons'))
    const msgs = c.issues.filter(i => i.level === 'error').map(i => i.message).join('\n')
    expect(msgs).toMatch(/cheatsheet\.pdf отсутствует/)
    expect(c.lessons.has('1.2')).toBe(false)
  })
  it('question/explanation — числа в yaml — error-issue, БЕЗ исключения', () => {
    const c = loadCourse(fx('quiz-nonstring'))
    const msgs = c.issues.filter(i => i.level === 'error').map(i => i.message).join('\n')
    expect(msgs).toMatch(/questions\[0\].*question\/explanation/)
    expect(msgs).toMatch(/questions\[1\].*question\/explanation/)
    expect(c.lessons.has('1.1')).toBe(false)
  })
  it('вопрос без correct — error «correct вне диапазона», урок не в lessons', () => {
    const c = loadCourse(fx('bad-lessons'))
    const msgs = c.issues.filter(i => i.level === 'error').map(i => i.message).join('\n')
    expect(msgs).toMatch(/questions\[0\]: correct вне диапазона/)
    expect(c.lessons.has('1.3')).toBe(false)
  })
  it('lesson.mdx с компонентом вне белого списка — error «lesson.mdx:», урок не в lessons', () => {
    const c = loadCourse(fx('bad-mdx'))
    const msgs = c.issues.filter(i => i.level === 'error').map(i => i.message).join('\n')
    expect(msgs).toMatch(/lesson\.mdx:.*Hacker/)
    expect(c.lessons.has('1.1')).toBe(false)
  })
  it('lesson.mdx с <Figure> на реально существующий файл в assets/ — 0 ошибок', () => {
    const c = loadCourse(fx('with-asset'))
    expect(c.issues.filter(i => i.level === 'error')).toHaveLength(0)
    expect(c.lessons.has('1.1')).toBe(true)
  })
  it('каталог урока на диске без записи в course.yaml — warning, не ошибка', () => {
    const c = loadCourse(fx('valid-course'))
    const warnings = c.issues.filter(i => i.level === 'warning').map(i => i.message).join('\n')
    expect(warnings).toMatch(/module-1[\\/]lesson-9\.9.*не указан в course\.yaml.*игнорируется/)
    expect(c.issues.filter(i => i.level === 'error')).toHaveLength(0)
  })
  it('отсутствие deferred в quiz.yaml — warning про 7 дней (D-012)', () => {
    const c = loadCourse(fx('valid-course'))
    const warnings = c.issues.filter(i => i.level === 'warning').map(i => i.message).join('\n')
    expect(warnings).toMatch(/deferred.*7 дней.*D-012/)
  })
})
