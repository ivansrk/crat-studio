/**
 * Карточка-постер направления (бриф §7.3): номер, label-моно, заголовок,
 * текст, красная линия. Используется для «Обучаем / Автоматизируем / Создаём».
 */
export function DirectionCard({
  num,
  kicker,
  title,
  text,
}: {
  num: string
  kicker: string
  title: string
  text: string
}) {
  return (
    <article className="crat-card direction-card">
      <span className="direction-card-num" aria-hidden="true">{num}</span>
      <span className="crat-kicker">{kicker}</span>
      <h3>{title}</h3>
      <p className="crat-muted">{text}</p>
      <span className="crat-red-line" aria-hidden="true" />
    </article>
  )
}
