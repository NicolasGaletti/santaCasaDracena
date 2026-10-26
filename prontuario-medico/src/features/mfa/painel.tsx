import type { ReactNode } from 'react'
import { sair } from '@/app/login/actions'
import { Button } from '@/components/ui/button'

/** Cartão central das telas de MFA (mesmo desenho do login). */
export function PainelMfa({ titulo, descricao, children }: { titulo: string; descricao: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-lg sm:p-8">
        <h1 className="text-2xl font-bold text-slate-800">{titulo}</h1>
        <p className="mt-2 mb-6 text-sm text-slate-600">{descricao}</p>
        {children}
        <form action={sair} className="mt-4 text-center">
          <Button type="submit" variant="link" className="text-slate-600">
            Sair
          </Button>
        </form>
      </div>
    </div>
  )
}
