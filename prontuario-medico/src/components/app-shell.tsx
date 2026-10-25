'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import { sair } from '@/app/login/actions'
import { Button } from '@/components/ui/button'
import { useAbaAtiva } from '@/components/navegacao-ativa'
import type { Profissional } from '@/lib/auth'

type Props = {
  profissional: Pick<Profissional, 'nome' | 'perfil' | 'conselho' | 'numero_conselho' | 'uf_conselho'>
  children: ReactNode
}

const PERFIS_QUE_ADMITEM = ['medico', 'recepcao'] as const
const ROTULO_PERFIL: Record<string, string> = { medico: 'Médico(a)', recepcao: 'Recepção' }

const NAVEGACAO = [
  { href: '/', chave: 'internados', rotulo: 'Internados', rotuloCurto: 'Internados' },
  { href: '/anteriores', chave: 'anteriores', rotulo: 'Internações anteriores', rotuloCurto: 'Anteriores' },
] as const

export function AppShell({ profissional, children }: Props) {
  const pathname = usePathname()
  const abaMarcada = useAbaAtiva()
  const podeAdmitir = (PERFIS_QUE_ADMITEM as readonly string[]).includes(profissional.perfil)
  const identificacao =
    profissional.conselho && profissional.numero_conselho
      ? `${profissional.conselho} ${profissional.numero_conselho}${profissional.uf_conselho ? `/${profissional.uf_conselho}` : ''}`
      : (ROTULO_PERFIL[profissional.perfil] ?? profissional.perfil)

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 lg:px-8">
          <div className="min-w-0">
            <p className="truncate font-bold text-foreground">{profissional.nome}</p>
            <p className="text-sm text-muted-foreground">{identificacao}</p>
          </div>
          <form action={sair}>
            <Button type="submit" variant="outline">
              Sair
            </Button>
          </form>
        </div>
      </header>

      <div className="mx-auto flex w-full min-w-0 max-w-6xl flex-1 flex-col gap-4 px-4 py-4 lg:px-8 lg:py-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <nav aria-label="Principal" className="flex gap-2">
            {NAVEGACAO.map((item) => {
              // Página de conteúdo (ex.: prontuário) pode marcar a aba pelo status da internação.
              const ativo = abaMarcada
                ? abaMarcada === item.chave
                : item.href === '/'
                  ? pathname === '/'
                  : pathname.startsWith(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={ativo ? 'page' : undefined}
                  className={`inline-flex min-h-11 items-center whitespace-nowrap rounded-md px-4 font-semibold transition-colors ${
                    ativo
                      ? 'bg-accent text-accent-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <span className="sm:hidden">{item.rotuloCurto}</span>
                  <span className="hidden sm:inline">{item.rotulo}</span>
                </Link>
              )
            })}
          </nav>
          {podeAdmitir && pathname === '/' && (
            <Button asChild size="lg" className="w-full lg:w-auto">
              <Link href="/internacoes/nova">Admitir paciente</Link>
            </Button>
          )}
        </div>
        <main className="flex min-w-0 flex-1 flex-col gap-4">{children}</main>
      </div>
    </div>
  )
}
