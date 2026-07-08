/** ADMIN_EMAILS="a@b.c, D@E.f" → нормализованный список без дублей (email: trim+lowercase, REG-08). */
export function parseAdminEmails(env: string | undefined): string[] {
  return [...new Set((env ?? '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean))]
}
