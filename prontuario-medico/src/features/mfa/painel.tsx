import type { ReactNode } from 'react'
import { CartaoAuth } from '@/components/layout/cartao-auth'
import { BotaoSair } from '@/features/sessao/botao-sair'

/** Cartão central das telas de MFA (mesmo desenho do login). */
export function PainelMfa({ titulo, descricao, children }: { titulo: string; descricao: string; children: ReactNode }) {
  return (
    <CartaoAuth titulo={titulo} descricao={descricao}>
      {children}
      <BotaoSair formClassName="mt-4 text-center" variant="link" className="text-slate-600" />
    </CartaoAuth>
  )
}
