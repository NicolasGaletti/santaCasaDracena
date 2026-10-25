import type { ReactNode } from 'react'
import { AppShell } from '@/components/app-shell'
import { contarPendentes } from '@/features/validacao/consultas'
import { exigirProfissional } from '@/lib/auth'

export default async function LayoutApp({ children }: { children: ReactNode }) {
  const profissional = await exigirProfissional()
  const pendentesValidacao = profissional.perfil === 'medico' ? await contarPendentes() : 0
  return (
    <AppShell profissional={profissional} pendentesValidacao={pendentesValidacao}>
      {children}
    </AppShell>
  )
}
