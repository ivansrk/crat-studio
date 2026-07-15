/**
 * Русская плюрализация: выбирает форму слова под число.
 * forms = [одна: 1 модуль, немного: 2 модуля, много: 5 модулей].
 * Нужна там, где число приходит из данных (course.yaml/lessonCount), а не задано
 * в словаре под конкретный курс — иначе «4 модули»/«1 модулей» на карточках каталога.
 */
export function plural(n: number, forms: readonly [string, string, string]): string {
  const abs = Math.abs(n)
  const mod10 = abs % 10
  const mod100 = abs % 100
  if (mod10 === 1 && mod100 !== 11) return forms[0]
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1]
  return forms[2]
}
