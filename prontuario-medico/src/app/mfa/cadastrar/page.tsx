import { redirect } from 'next/navigation'
import { exigirSessaoMfa } from '@/lib/auth'
import { CadastrarMfa } from '@/features/mfa/cadastrar-mfa'
import { PainelMfa } from '@/features/mfa/painel'

export default async function CadastrarMfaPage() {
  const { temFator, verificado } = await exigirSessaoMfa()
  if (temFator) redirect(verificado ? '/' : '/mfa/verificar')

  return (
    <PainelMfa
      titulo="Proteja sua conta"
      descricao="Administradores precisam de um aplicativo autenticador (Google Authenticator, Microsoft Authenticator ou Authy). Você faz este cadastro uma vez."
    >
      <CadastrarMfa destino="/" />
    </PainelMfa>
  )
}
