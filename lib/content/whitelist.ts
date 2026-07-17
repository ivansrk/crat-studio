/** Компоненты белого списка урока (lesson.mdx) — контракт §4/v2. */
export const MDX_COMPONENTS = ['Figure', 'Gallery', 'Callout', 'Video', 'Download', 'Trainer', 'Animation', 'Divider'] as const
/** D-052 (§8 v2.1): редакционные компоненты, разрешённые ТОЛЬКО в статьях (article.mdx).
 *  В уроках они вне белого списка — валидатор их отклонит (уроки принимать не обязаны). */
export const ARTICLE_COMPONENTS = ['Lead', 'PullQuote', 'KeyPoints', 'Sources'] as const
export type MdxComponentName = (typeof MDX_COMPONENTS)[number] | (typeof ARTICLE_COMPONENTS)[number]
export const TRAINER_IDS = ['t1', 't2', 't3'] as const
