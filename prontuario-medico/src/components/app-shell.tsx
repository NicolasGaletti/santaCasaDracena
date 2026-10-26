'use client'

import { UserRound } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { BotaoSair } from '@/features/sessao/botao-sair'
import { Sino } from '@/features/notificacoes/sino'
import { useAbaAtiva } from '@/components/navegacao-ativa'
import type { Profissional } from '@/lib/auth'
import { rotuloIdentificacao } from '@/lib/rotulos-perfil'

type Props = {
  profissional: Pick<Profissional, 'nome' | 'perfil' | 'categoria' | 'conselho' | 'numero_conselho' | 'uf_conselho'>
  /** Evoluções aguardando a validação deste médico (zero para os demais perfis). */
  pendentesValidacao?: number
  /** Id do usuário (filtro do Realtime) e notificações não lidas no carregamento. */
  usuarioId?: string
  naoLidas?: number
  children: ReactNode
}

const PERFIS_QUE_ADMITEM = ['medico', 'recepcao'] as const
const PERFIS_NAO_CLINICOS = ['recepcao', 'admin'] as const

type ItemNavegacao = { href: string; chave: string; rotulo: string; rotuloCurto: string; prefixo?: string }

const NAVEGACAO: ItemNavegacao[] = [
  { href: '/', chave: 'internados', rotulo: 'Internados', rotuloCurto: 'Internados' },
  { href: '/anteriores', chave: 'anteriores', rotulo: 'Internações anteriores', rotuloCurto: 'Anteriores' },
]

const ITEM_VALIDACAO: ItemNavegacao = { href: '/validacao', chave: 'validacao', rotulo: 'Validar', rotuloCurto: 'Validar' }

const ITEM_ADMIN: ItemNavegacao = {
  href: '/admin/profissionais',
  chave: 'admin',
  rotulo: 'Administração',
  rotuloCurto: 'Administração',
  prefixo: '/admin',
}

const ITEM_AUDITORIA: ItemNavegacao = { href: '/auditoria', chave: 'auditoria', rotulo: 'Auditoria', rotuloCurto: 'Auditoria' }

const ITEM_IMPRIMIR: ItemNavegacao = { href: '/imprimir', chave: 'imprimir', rotulo: 'Imprimir', rotuloCurto: 'Imprimir' }

export function AppShell({ profissional, pendentesValidacao = 0, usuarioId, naoLidas = 0, children }: Props) {
  const pathname = usePathname()
  const abaMarcada = useAbaAtiva()
  const podeAdmitir = (PERFIS_QUE_ADMITEM as readonly string[]).includes(profissional.perfil)
  const clinico = !(PERFIS_NAO_CLINICOS as readonly string[]).includes(profissional.perfil)
  const medico = profissional.perfil === 'medico'
  const admin = profissional.perfil === 'admin'
  // Admin não vê conteúdo clínico: só a aba de administração.
  const navegacao: ItemNavegacao[] = admin
    ? [ITEM_ADMIN]
    : !clinico
      ? NAVEGACAO
      : [...NAVEGACAO, ...(medico ? [ITEM_VALIDACAO] : []), ITEM_IMPRIMIR, ...(profissional.perfil === 'auditoria' ? [ITEM_AUDITORIA] : [])]
  const identificacao = rotuloIdentificacao(profissional)

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 lg:px-8">
          <div className="min-w-0">
            <p className="truncate font-bold text-foreground">{profissional.nome}</p>
            <p className="text-sm text-muted-foreground">{identificacao}</p>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            {!admin && usuarioId && <Sino usuarioId={usuarioId} inicial={naoLidas} />}
            <Link
              href="/conta/seguranca"
              aria-label="Conta e segurança"
              className="inline-flex h-11 min-w-11 items-center justify-center gap-2 rounded-md px-2.5 text-foreground transition-colors hover:bg-muted"
            >
              <UserRound aria-hidden className="size-6" />
              <span className="hidden text-sm font-medium lg:inline">Segurança</span>
            </Link>
            <BotaoSair />
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full min-w-0 max-w-6xl flex-1 flex-col gap-4 px-4 py-4 lg:px-8 lg:py-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <nav
            aria-label="Principal"
            className="-mx-4 flex snap-x scroll-px-4 gap-2 overflow-x-auto px-4 py-1.5 [scrollbar-width:none] lg:mx-0 lg:px-0 [&::-webkit-scrollbar]:hidden"
          >
            {navegacao.map((item) => {
              // Página de conteúdo (ex.: prontuário) pode marcar a aba pelo status da internação.
              const ativo = abaMarcada
                ? abaMarcada === item.chave
                : item.href === '/'
                  ? pathname === '/'
                  : pathname.startsWith(item.prefixo ?? item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={ativo ? 'page' : undefined}
                  className={`inline-flex min-h-11 shrink-0 snap-start items-center whitespace-nowrap rounded-md px-3 font-semibold sm:px-4 transition-colors ${
                    ativo
                      ? 'bg-accent text-accent-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <span className="sm:hidden">{item.rotuloCurto}</span>
                  <span className="hidden sm:inline">{item.rotulo}</span>
                  {item.chave === 'validacao' && pendentesValidacao > 0 && (
                    <Badge data-testid="contador-validacao" aria-label={`${pendentesValidacao} pendentes`} className="ml-2 min-w-6 justify-center px-1.5 text-xs tabular-nums">
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
