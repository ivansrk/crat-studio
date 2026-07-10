/** id → CSS-класс. Расширение = новая запись здесь + keyframes в animations.css (Task 7). */
export const ANIMATIONS: Record<string, string> = {
  'neon-pulse': 'anim-neon-pulse',
}
export const animationIds = new Set(Object.keys(ANIMATIONS))
