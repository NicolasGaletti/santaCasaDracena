'use client'

import { Bell } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { createBrowserSupabase } from '@/lib/supabase/client'

export const EVENTO_ATUALIZAR = 'notificacoes:atualizar'

type Props = { usuarioId: string; inicial: number }

/** Sino com o contador de não lidas; Realtime (filtrado pelo usuário) atualiza sem recarregar. */
export function Sino({ usuarioId, inicial }: Props) {
  const pathname = usePathname()
  const [total, setTotal] = useState(inicial)
  const supabase = useRef<ReturnType<typeof createBrowserSupabase> | null>(null)

  useEffect(() => {
    const cliente = (supabase.current ??= createBrowserSupabase())
    let ativo = true
    const atualizar = async () => {
      const { count } = await cliente.from('notificacoes').select('id', { count: 'exact', head: true }).is('lida_em', null)
      if (ativo && count !== null) setTotal(count)
    }
    let canal: ReturnType<typeof cliente.channel> | null = null
    // O Realtime precisa do JWT do usuário (senão a RLS esconde as linhas); assina só depois.
    void cliente.auth.getSession().then(async ({ data }) => {
      if (!ativo) return
      if (data.session) await cliente.realtime.setAuth(data.session.access_token)
      if (!ativo) return
      canal = cliente
        .channel(`sino-${usuarioId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'notificacoes', filter: `destinatario_id=eq.${usuarioId}` },
          () => void atualizar(),
        )
        .subscribe()
    })
    // Lista de notificações avisa quando marca como lida (não depende do evento do Realtime).
    const aoMarcar = () => void atualizar()
    window.addEventListener(EVENTO_ATUALIZAR, aoMarcar)
    return () => {
      ativo = false
      window.removeEventListener(EVENTO_ATUALIZAR, aoMarcar)
      if (canal) void cliente.removeChannel(canal)
    }
  }, [usuarioId])

  // Ao navegar (ex.: depois de marcar como lida) confere de novo, caso o evento tenha se perdido.
  const primeira = useRef(true)
  useEffect(() => {
    if (primeira.current) {
      primeira.current = false
      return
    }
    const cliente = (supabase.current ??= createBrowserSupabase())
    void cliente
      .from('notificacoes')
      .select('id', { count: 'exact', head: true })
      .is('lida_em', null)
      .then(({ count }) => {
        if (count !== null) setTotal(count)
      })
  }, [pathname])

  return (
    <Link
      href="/notificacoes"
      aria-label={total > 0 ? `Notificações, ${total} não lidas` : 'Notificações'}
      className="relative inline-flex size-11 items-center justify-center rounded-md text-current transition-colors hover:bg-white/10"
    >
      <Bell aria-hidden className="size-6" />
      {total > 0 && (
        <span
          data-testid="contador-notificacoes"
          className="absolute top-1 right-0.5 inline-flex min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-xs font-bold leading-5 text-white tabular-nums"
        >
          {total}
        </span>
      )}
    </Link>
  )
}
