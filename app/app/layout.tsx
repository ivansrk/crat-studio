import { redirect } from 'next/navigation'
import { currentUser } from '@/lib/auth/current-user'
import { CabinetHeader } from '@/components/site/CabinetHeader'

// T4 дизайн-аудита: раньше голый гейт без разметки — на страницах кабинета не было
// шапки вовсе, «Аккаунт»/«Выйти» дублировались локально на каждой странице.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser()
  if (!user) redirect('/login')
  return (
    <>
      <CabinetHeader />
      {children}
    </>
  )
}
