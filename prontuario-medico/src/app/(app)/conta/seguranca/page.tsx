import { ShieldCheck } from 'lucide-react'
import { CartaoSecao } from '@/components/layout/cartao-secao'
import { exigirProfissional } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { ConfigurarMfa } from '@/features/mfa/configurar-mfa'

export default async function SegurancaPage() {
  const profissional = await exigirProfissional()
  const supabase = await createClient()
  const { data } = await supabase.auth.mfa.listFactors()
  const ativo = (data?.totp.length ?? 0) > 0

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Segurança da conta</h1>
      <CartaoSecao titulo="Autenticador" icone={ShieldCheck} className="max-w-xl">
        {ativo ? (
          <p className="rounded-lg border border-status-feito-bg bg-status-feito-bg p-3 text-sm font-semibold text-status-feito-fg">
            Autenticador ativo. {profissional.perfil === 'admin' ? 'Ele é pedido a cada login.' : 'Você pode usá-lo para reforçar sua conta.'}
          </p>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Autenticador não configurado. Cadastre um aplicativo autenticador para reforçar sua conta com um código de 6 dígitos.
            </p>
            <ConfigurarMfa />
          </div>
        )}
      </CartaoSecao>
    </div>
  )
}
