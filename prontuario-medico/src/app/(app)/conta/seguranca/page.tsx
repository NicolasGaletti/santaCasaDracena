import { exigirProfissional } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { ConfigurarMfa } from '@/features/mfa/configurar-mfa'

export default async function SegurancaPage() {
  const profissional = await exigirProfissional()
  const supabase = await createClient()
  const { data } = await supabase.auth.mfa.listFactors()
  const ativo = (data?.totp.length ?? 0) > 0

  return (
    <div className="max-w-md space-y-4">
      <h1 className="text-xl font-bold text-foreground">Segurança da conta</h1>
      {ativo ? (
        <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
          Autenticador ativo. {profissional.perfil === 'admin' ? 'Ele é pedido a cada login.' : 'Você pode usá-lo para reforçar sua conta.'}
        </p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Autenticador não configurado. Cadastre um aplicativo autenticador para reforçar sua conta com um código de 6 dígitos.
          </p>
          <ConfigurarMfa />
        </>
      )}
    </div>
  )
}
