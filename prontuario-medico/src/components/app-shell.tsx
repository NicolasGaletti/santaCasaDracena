'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import { sair } from '@/app/login/actions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAbaAtiva } from '@/components/navegacao-ativa'
import type { Profissional } from '@/lib/auth'
import { rotuloIdentificacao } from '@/lib/rotulos-perfil'

type Props = {
  profissional: Pick<Profissional, 'nome' | 'perfil' | 'categoria' | 'conselho' | 'numero_conselho' | 'uf_conselho'>
  /** Evoluções aguardando a validação deste médico (zero para os demais perfis). */
  pendentesValidacao?: number
  children: ReactNode
}

const PERFIS_QUE_ADMITEM = ['medico', 'recepcao'] as const
const PERFIS_NAO_CLINICOS = ['recepcao', 'admin'] as const

type ItemNavegacao = { href: string; chave: string; rotulo: string; rotuloCurto: string }

const NAVEGACAO: ItemNavegacao[] = [
  { href: '/', chave: 'internados', rotulo: 'Internados', rotuloCurto: 'Internados' },
  { href: '/anteriores', chave: 'anteriores', rotulo: 'Internações anteriores', rotuloCurto: 'Anteriores' },
]

const ITEM_VALIDACAO: ItemNavegacao = { href: '/validacao', chave: 'validacao', rotulo: 'Validar', rotuloCurto: 'Validar' }

const ITEM_IMPRIMIR: ItemNavegacao = { href: '/imprimir', chave: 'imprimir', rotulo: 'Imprimir', rotuloCurto: 'Imprimir' }

export function AppShell({ profissional, pendentesValidacao = 0, children }: Props) {
  const pathname = usePathname()
  const abaMarcada = useAbaAtiva()
  const podeAdmitir = (PERFIS_QUE_ADMITEM as readonly string[]).includes(profissional.perfil)
  const clinico = !(PERFIS_NAO_CLINICOS as readonly string[]).includes(profissional.perfil)
  const medico = profissional.perfil === 'medico'
  const navegacao: ItemNavegacao[] = !clinico
    ? NAVEGACAO
    : [...NAVEGACAO, ...(medico ? [ITEM_VALIDACAO] : []), ITEM_IMPRIMIR]
  const identificacao = rotuloIdentificacao(profissional)

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
            {navegacao.map((item) => {
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
                  className={`inline-flex min-h-11 items-center whitespace-nowrap rounded-md px-3 font-semibold sm:px-4 transition-colors ${
                    ativo
                      ? 'bg-accent text-accent-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <span className="sm:hidden">{item.rotuloCurto}</span>
                  <span className="hidden sm:inline">{item.rotulo}</span>
                  {item.chave === 'validacao' && pendentesValidacao > 0 && (
                    <Badge data-testid="contador-validacao" className="ml-2 min-w-6 justify-center px-1.5 text-xs tabular-nums">
                      {pendentesValidacao}
                    </Badge>
                  )}
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
