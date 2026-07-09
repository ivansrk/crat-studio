import { db } from '@/lib/db'
import { t } from '@/lib/i18n'

export const dynamic = 'force-dynamic'
export default async function Students() {
  const users = await db.user.findMany({ include: { enrollments: true }, orderBy: { createdAt: 'desc' } })
  if (users.length === 0) return <main className="admin-wide"><h1>{t.admin.students}</h1><p>{t.admin.noData}</p></main>
  return (
    <main className="admin-wide">
      <h1>{t.admin.students}</h1>
      <table className="admin-table">
        <tbody>
        {users.map(u => (
          <tr key={u.id}>
            <td>{u.firstName} {u.lastName}</td>
            <td>{u.email}</td>
            <td>{u.enrollments[0]?.createdAt.toLocaleDateString('ru-RU') ?? ''}</td>
          </tr>
        ))}
        </tbody>
      </table>
    </main>
  )
}
