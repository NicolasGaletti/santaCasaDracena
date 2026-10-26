import { AtivarPush } from '@/features/notificacoes/ativar-push'
import { lerPreferencias } from '@/features/notificacoes/consultas'
import { Preferencias } from '@/features/notificacoes/preferencias'
import { exigirProfissional } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function ContaNotificacoesPage() {
  const profissional = await exigirProfissional()
  if (profissional.perfil === 'admin') redirect('/conta/seguranca')
  const prefs = await lerPreferencias()
  return (
    <div className="max-w-md space-y-6">
      <h1 className="text-xl font-bold text-foreground">Notificações</h1>
      <Preferencias pushValidacao={prefs.pushValidacao} pushDevolvida={prefs.pushDevolvida} medico={profissional.perfil === 'medico'} />
      <AtivarPush />
    </div>
  )
}
