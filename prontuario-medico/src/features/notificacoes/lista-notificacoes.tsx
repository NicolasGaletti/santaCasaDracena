'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { createBrowserSupabase } from '@/lib/supabase/client'
import { EVENTO_ATUALIZAR } from './sino'
import { destinoNotificacao } from './destino'
import type { Notificacao } from './consultas'

const FORMATO = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })
const formatarDataHora = (iso: string) => FORMATO.format(new Date(iso))

export function ListaNotificacoes({ itens }: { itens: Notificacao[] }) {
  const router = useRouter()
  const [lidas, setLidas] = useState<Set<string>>(new Set())
  const [, iniciar] = useTransition()
  const estaLida = (n: Notificacao) => n.lida_em !== null || lidas.has(n.id)
  const naoLidas = itens.filter((n) => !estaLida(n)).length

  async function marcar(id: string) {
    setLidas((atual) => new Set(atual).add(id))
    await createBrowserSupabase().rpc('marcar_lida', { p_id: id })
    window.dispatchEvent(new Event(EVENTO_ATUALIZAR))
  }

  async function marcarTodas() {
    const { error } = await createBrowserSupabase().rpc('marcar_todas_lidas')
    if (error) return
    setLidas(new Set(itens.map((n) => n.id)))
    window.dispatchEvent(new Event(EVENTO_ATUALIZAR))
    iniciar(() => router.refresh())
  }

  if (itens.length === 0) {
    return <p className="rounded-xl border border-dashed border-input bg-card p-6 text-center text-muted-foreground">Nenhuma notificação por aqui.</p>
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <Button type="button" variant="contorno-teal" size="compacto" disabled={naoLidas === 0} onClick={marcarTodas}>
          Marcar todas como lidas
        </Button>
      </div>
      <ul className="overflow-hidden rounded-xl border border-border bg-card">
        {itens.map((n) => {
          const lida = estaLida(n)
          return (
            <li key={n.id} className="border-b border-border last:border-b-0">
              <Link
                href={destinoNotificacao(n)}
                onClick={() => {
                  if (!lida) void marcar(n.id)
                }}
                data-lida={lida}
                className={`flex min-h-14 items-start gap-3 px-4 py-3 transition-colors hover:bg-muted ${lida ? 'text-muted-foreground' : 'bg-primary-suave text-foreground'}`}
              >
                <span
                  aria-hidden
                  className={`mt-2 size-2.5 shrink-0 rounded-full ${lida ? 'bg-transparent' : 'bg-primary'}`}
                />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className={lida ? '' : 'font-bold'}>{n.texto}</span>
                  <span className="text-sm text-muted-foreground">
                    {formatarDataHora(n.criada_em)}
                    {lida ? '' : ' · não lida'}
                  </span>
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
