import type { ReactNode } from 'react'
import { SubnavConta } from '@/features/notificacoes/subnav-conta'
import { exigirProfissional } from '@/lib/auth'

export default async function LayoutConta({ children }: { children: ReactNode }) {
  const profissional = await exigirProfissional()
  return (
    <>
      <SubnavConta admin={profissional.perfil === 'admin'} />
      {children}
    </>
  )
}
