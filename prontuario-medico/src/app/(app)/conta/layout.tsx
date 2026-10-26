import type { ReactNode } from 'react'
import { SubnavConta } from '@/features/notificacoes/subnav-conta'
import { exigirProfissional } from '@/lib/auth'

export default async function LayoutConta({ children }: { children: ReactNode }) {
  const profissional = await exigirProfissional()
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <SubnavConta admin={profissional.perfil === 'admin'} />
      {children}
    </div>
  )
}
