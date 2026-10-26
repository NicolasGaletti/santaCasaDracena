import { redirect } from 'next/navigation'
import { exigirSessaoMfa } from '@/lib/auth'
import { destinoSeguro } from '@/lib/redirect'
import { CadastrarMfa } from '@/features/mfa/cadastrar-mfa'
import { PainelMfa } from '@/features/mfa/painel'

export default async function CadastrarMfaPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const destino = destinoSeguro((await searchParams).next)
  const { temFator, verificado } = await exigirSessaoMfa()
  if (temFator) redirect(verificado ? destino : `/mfa/verificar?next=${encodeURIComponent(destino)}`)

  return (
    <PainelMfa
      titulo="Proteja sua conta"
      descricao="Administradores precisam de um aplicativo autenticador (Google Authenticator, Microsoft Authenticator ou Authy). Você faz este cadastro uma vez."
    >
      <CadastrarMfa destino={destino} />
    </PainelMfa>
  )
}
