import type { ReactNode } from 'react'
import { AppShell } from '@/components/app-shell'
import { contarPendentes } from '@/features/validacao/consultas'
import { contarNaoLidas } from '@/features/notificacoes/consultas'
import { MonitorInatividade } from '@/features/sessao/monitor-inatividade'
import { exigirProfissional } from '@/lib/auth'

export default async function LayoutApp({ children }: { children: ReactNode }) {
  const profissional = await exigirProfissional()
  const [pendentesValidacao, naoLidas] = await Promise.all([
    profissional.perfil === 'medico' ? contarPendentes() : 0,
    profissional.perfil === 'admin' ? 0 : contarNaoLidas(),
  ])
  return (
    <AppShell profissional={profissional} pendentesValidacao={pendentesValidacao} usuarioId={profissional.id} naoLidas={naoLidas}>
      <MonitorInatividade />
      {children}
    </AppShell>
  )
}
