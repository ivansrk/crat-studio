import { describe, it, expect } from 'vitest'
import { escapeHtml, renderConsultationEmail, fillPlaceholders, renderEmail } from './templates'

// M-1 (ревью Ф7б): name/contact/topic/message из публичной формы /consult попадали в HTML письма
// админам без экранирования — `<a href="https://evil.example">…</a>` в message рендерился бы
// кликабельной ссылкой (phishing на админов). Проверяем, что теперь инъекция обезврежена.

describe('escapeHtml', () => {
  it('экранирует & < > " \'', () => {
    expect(escapeHtml(`& < > " '`)).toBe('&amp; &lt; &gt; &quot; &#39;')
  })

  it('обычный текст без спецсимволов не меняется', () => {
    expect(escapeHtml('Нужна автоматизация процессов')).toBe('Нужна автоматизация процессов')
  })
})

describe('renderConsultationEmail (M-1)', () => {
  it('вредоносная ссылка в message → экранирована, ссылка не живая', () => {
    const html = renderConsultationEmail({
      name: 'Иван', contact: 'a@b.c', topic: null,
      message: '<a href="https://evil.example">кликни тут</a>',
    })

    expect(html).toContain('&lt;a href=&quot;https://evil.example&quot;&gt;кликни тут&lt;/a&gt;')
    expect(html).not.toContain('<a href="https://evil.example">')
  })

  it('<b>/другие теги в имени и контакте тоже экранированы', () => {
    const html = renderConsultationEmail({
      name: '<b>Иван</b>', contact: '<img src=x onerror=alert(1)>', topic: null, message: 'm',
    })

    expect(html).toContain('&lt;b&gt;Иван&lt;/b&gt;')
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;')
    expect(html).not.toContain('<b>Иван</b>')
    expect(html).not.toContain('<img src=x')
  })

  it('topic из вайтлиста ru.ts проходит как есть (экранирование его не портит)', () => {
    const html = renderConsultationEmail({ name: 'И', contact: 'c', topic: 'automation', message: 'm' })
    expect(html).toContain('automation')
  })

  it('topic отсутствует → прочерк, как раньше', () => {
    const html = renderConsultationEmail({ name: 'И', contact: 'c', topic: null, message: 'm' })
    expect(html).toContain('—')
  })

  it('шаблонные <br/> из ru.ts (consultationBody) не экранируются', () => {
    const html = renderConsultationEmail({ name: 'И', contact: 'c', topic: null, message: 'm' })
    expect(html).toContain('<br/>')
  })
})

describe('fillPlaceholders / renderEmail — не задеты фиксом', () => {
  it('обычная подстановка без экранирования (WELCOME-путь) работает как раньше', () => {
    expect(fillPlaceholders('Привет, {{name}}!', { name: 'Иван' })).toBe('Привет, Иван!')
  })

  it('renderEmail не экранирует body — экранирование лежит на вызывающем коде', () => {
    const html = renderEmail({ body: '<strong>ok</strong>' })
    expect(html).toContain('<strong>ok</strong>')
  })
})
