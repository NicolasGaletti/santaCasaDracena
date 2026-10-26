import type { ReactNode } from 'react'
import { AppShell } from '@/components/app-shell'
import { contarPendentes } from '@/features/validacao/consultas'
import { contarNaoLidas } from '@/features/notificacoes/consultas'
import { exigirProfissional } from '@/lib/auth'

export default async function LayoutApp({ children }: { children: ReactNode }) {
  const profissional = await exigirProfissional()
  const pendentesValidacao = profissional.perfil === 'medico' ? await contarPendentes() : 0
  const naoLidas = profissional.perfil === 'admin' ? 0 : await contarNaoLidas()
  return (
    <AppShell profissional={profissional} pendentesValidacao={pendentesValidacao} usuarioId={profissional.id} naoLidas={naoLidas}>
      {children}
    </AppShell>
  )
}
