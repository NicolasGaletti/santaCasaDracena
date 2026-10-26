import { ListaNotificacoes } from '@/features/notificacoes/lista-notificacoes'
import { listarNotificacoes } from '@/features/notificacoes/consultas'
import { exigirProfissional } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function NotificacoesPage() {
  const profissional = await exigirProfissional()
  if (profissional.perfil === 'admin') redirect('/admin/profissionais')
  const itens = await listarNotificacoes()
  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <h1 className="text-xl font-bold text-foreground sm:text-2xl">Notificações</h1>
      <ListaNotificacoes itens={itens} />
    </div>
  )
}
