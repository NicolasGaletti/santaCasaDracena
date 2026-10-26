import { redirect } from 'next/navigation'
import { exigirSessaoMfa } from '@/lib/auth'
import { PainelMfa } from '@/features/mfa/painel'
import { VerificarMfa } from '@/features/mfa/verificar-mfa'

export default async function VerificarMfaPage() {
  const { temFator, fatorId, verificado } = await exigirSessaoMfa()
  if (!temFator || !fatorId) redirect('/mfa/cadastrar')
  if (verificado) redirect('/')

  return (
    <PainelMfa titulo="Confirme seu acesso" descricao="Digite o código de 6 dígitos do seu aplicativo autenticador.">
      <VerificarMfa fatorId={fatorId} destino="/" />
    </PainelMfa>
  )
}
