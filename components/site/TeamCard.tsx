import Image from 'next/image'

/**
 * «Архивное досье» участника команды (бриф §7.9 / §11): номер, портретное фото
 * 4:5 (реальный человек, не сток — обработка team-photos), имя, роль, текст,
 * mono-теги. Номер-бейдж — элемент бренда, вынесен поверх фото (bottom-left) на
 * собственном scrim (та же схема, что hero-visual-scrim в crat.css), чтобы
 * оставаться читаемым на любом фоне фото.
 */
export function TeamCard({
  num,
  name,
  role,
  text,
  tags,
  photo,
}: {
  num: string
  name: string
  role: string
  text: string
  tags: readonly string[]
  photo: string
}) {
  return (
    <article className="crat-card team-card">
      <div className="crat-visual-frame crat-noise team-card-frame">
        <Image
          src={`/images/team/${photo}.webp`}
          alt={name}
          fill
          sizes="(max-width: 700px) 100vw, 50vw"
          className="crat-frame-img team-card-img"
        />
        <span className="team-card-scrim" aria-hidden="true" />
        <span className="crat-kicker team-card-num" aria-hidden="true">{num}</span>
      </div>
      <h3>{name}</h3>
      <p className="crat-muted team-card-role">{role}</p>
      {/* Красная линия-акцент перенесена из кадра (перечёркивала фигуру — «странная»,
          критика Ивана) в текстовый блок: тот же брендовый штрих, что у DirectionCard,
          но «на своём месте» — разделитель шапки досье, не поверх лица. */}
      <span className="crat-red-line team-card-line" aria-hidden="true" />
      <p className="crat-muted">{text}</p>
      <div className="team-card-tags">
        {tags.map(tag => (
          <span key={tag} className="crat-tag">{tag}</span>
        ))}
      </div>
    </article>
  )
}
