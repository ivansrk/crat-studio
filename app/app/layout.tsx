import { redirect } from 'next/navigation'
import { currentUser } from '@/lib/auth/current-user'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser()
  if (!user) redirect('/login')
  return <>{children}</>
}
