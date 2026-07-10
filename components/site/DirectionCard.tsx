import Image from 'next/image'

/**
 * Карточка-постер направления (бриф §7.3, обновлено Ф7в/D-038): сгенерированная
 * картинка постером на весь фон карточки (4/5 десктоп, 16/9 мобильный —
 * .direction-card в site.css), тёмный градиент снизу для читаемости текста,
 * номер/label-моно/заголовок/текст/красная линия — поверх. Slow zoom на hover.
 * Картинка декоративная (alt="") — весь смысл уже в тексте карточки.
 */
export function DirectionCard({
  kicker,
  title,
  text,
  image,
}: {
  kicker: string
  title: string
  text: string
  image: string
}) {
  return (
    <article className="crat-card direction-card crat-frame-gradient">
      <Image
        src={image}
        alt=""
        fill
        sizes="(max-width: 900px) 100vw, 33vw"
        className="direction-card-img"
      />
      <span className="direction-card-scrim" aria-hidden="true" />
      <div className="direction-card-body">
        {/* impeccable P2-1б: номер карточки убран — порядок «Обучаем/Автоматизируем/
            Создаём» не несёт смысла, нумерация была ярлычным рефлексом (критика 2026-07-10).
            Номера у «Процесс»/«Команда» остаются — там семантика (шаг/досье). */}
        <span className="crat-kicker">{kicker}</span>
        <h3>{title}</h3>
        <p className="crat-muted">{text}</p>
        <span className="crat-red-line" aria-hidden="true" />
      </div>
    </article>
  )
}
