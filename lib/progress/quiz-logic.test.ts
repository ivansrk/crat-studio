import { describe, it, expect } from 'vitest'
import { scoreAnswers, isQuizPassed, nextQuestionIndex, isReplay, PASS_SCORE, QUIZ_TOTAL, type StoredAnswer } from './quiz-logic'

const a = (questionIndex: number, chosen: number, correct: boolean): StoredAnswer => ({ questionIndex, chosen, correct })

describe('quiz-logic', () => {
  it('scoreAnswers считает только correct', () => {
    expect(scoreAnswers([a(0, 1, true), a(1, 0, false), a(2, 2, true)])).toBe(2)
    expect(scoreAnswers([])).toBe(0)
  })
  it('isQuizPassed: порог 2 из 3 (LES-08, D-004)', () => {
    expect(PASS_SCORE).toBe(2)
    expect(QUIZ_TOTAL).toBe(3)
    expect(isQuizPassed(2)).toBe(true)
    expect(isQuizPassed(3)).toBe(true)
    expect(isQuizPassed(1)).toBe(false)
  })
  it('nextQuestionIndex — первый неотвеченный; после трёх — null', () => {
    expect(nextQuestionIndex([])).toBe(0)
    expect(nextQuestionIndex([a(0, 1, true)])).toBe(1)
    expect(nextQuestionIndex([a(0, 1, true), a(1, 0, false), a(2, 2, true)])).toBeNull()
  })
  it('nextQuestionIndex терпит дыры/дубли (битые answers из базы): идёт по возрастанию', () => {
    expect(nextQuestionIndex([a(1, 0, true)])).toBe(0)
    expect(nextQuestionIndex([a(0, 1, true), a(0, 2, false)])).toBe(1)
  })
  it('isReplay: повтор того же chosen → сохранённая запись (двойной клик)', () => {
    const saved = a(0, 1, true)
    expect(isReplay([saved, a(1, 0, false)], 0, 1)).toBe(saved)
    expect(isReplay([saved], 0, 1)).toBe(saved)
  })
  it('isReplay: другой chosen на уже отвеченный вопрос → null (реальный out-of-order)', () => {
    expect(isReplay([a(0, 1, true)], 0, 2)).toBeNull()
  })
  it('isReplay: неотвеченный вопрос → null', () => {
    expect(isReplay([a(0, 1, true)], 1, 0)).toBeNull()
    expect(isReplay([], 0, 0)).toBeNull()
  })
})
