import { redirect } from 'next/navigation'
import { exigirSessaoMfa } from '@/lib/auth'
import { destinoSeguro } from '@/lib/redirect'
import { PainelMfa } from '@/features/mfa/painel'
import { VerificarMfa } from '@/features/mfa/verificar-mfa'

export default async function VerificarMfaPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const destino = destinoSeguro((await searchParams).next)
  const { temFator, fatorId, verificado } = await exigirSessaoMfa()
  if (!temFator || !fatorId) redirect(destino === '/' ? '/mfa/cadastrar' : `/mfa/cadastrar?next=${encodeURIComponent(destino)}`)
  if (verificado) redirect(destino)

  return (
    <PainelMfa titulo="Confirme seu acesso" descricao="Digite o código de 6 dígitos do seu aplicativo autenticador.">
      <VerificarMfa fatorId={fatorId} destino={destino} />
    </PainelMfa>
  )
}
