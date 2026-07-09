/**
 * «Архивное досье» участника команды (бриф §7.9 / §11): номер, CSS-кадр вместо
 * фото (без стоков — бриф §13), имя, роль, текст, mono-теги.
 */
export function TeamCard({
  num,
  name,
  role,
  text,
  tags,
}: {
  num: string
  name: string
  role: string
  text: string
  tags: readonly string[]
}) {
  return (
    <article className="crat-card team-card">
      <div className="crat-visual-frame neon-line crat-noise team-card-frame" aria-hidden="true">
        <span className="crat-kicker team-card-num">{num}</span>
      </div>
      <h3>{name}</h3>
      <p className="crat-muted team-card-role">{role}</p>
      <p className="crat-muted">{text}</p>
      <div className="team-card-tags">
        {tags.map(tag => (
          <span key={tag} className="crat-tag">{tag}</span>
        ))}
      </div>
    </article>
  )
}
