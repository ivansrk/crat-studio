// Правило 5: в базе UTC, отображение — Europe/Warsaw.
export const formatDate = (d: Date) => d.toLocaleDateString('ru-RU', { timeZone: 'Europe/Warsaw' })
export const formatDateTime = (d: Date) =>
  d.toLocaleString('ru-RU', { timeZone: 'Europe/Warsaw', dateStyle: 'short', timeStyle: 'short' })
