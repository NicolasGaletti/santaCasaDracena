import Image from 'next/image'
import type { ReactNode } from 'react'
import logo from '@/assets/logo-santa-casa.png'

type Props = { titulo: string; descricao?: string; children: ReactNode }

/** Cartão central das telas públicas (login, senha, MFA): marca do app, título e conteúdo sobre fundo slate-50. */
export function CartaoAuth({ titulo, descricao, children }: Props) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="flex items-center gap-3 bg-cabecalho px-5 py-4 text-cabecalho-foreground">
          <Image src={logo} alt="" width={40} height={33} priority className="h-auto w-10 shrink-0 rounded-sm bg-white p-0.5" />
          <p className="font-heading text-base leading-tight font-bold">Prontuário Santa Casa</p>
        </div>
        <div className="p-5 sm:p-7">
          <h1 className="font-heading text-xl font-bold text-foreground">{titulo}</h1>
          {descricao && <p className="mt-1 mb-5 text-sm text-muted-foreground">{descricao}</p>}
          {!descricao && <div className="mb-5" />}
          {children}
        </div>
      </div>
    </main>
  )
}
