'use client'

import { Plus } from 'lucide-react'
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { armazenamentoIdb } from './autosave'

type Contexto = { aberta: boolean; foco: boolean; abrir: (opcoes?: { foco?: boolean }) => void }

const FichaContexto = createContext<Contexto | null>(null)

function useFicha(): Contexto {
  const ctx = useContext(FichaContexto)
  if (!ctx) throw new Error('Componente da ficha fora do FichaProvider')
  return ctx
}

/**
 * Estado aberta/fechada da ficha de evolução. Nasce fechada; abre sozinha quando:
 * - a URL tem `#ficha` (redirects de admissão, adendo e reabrir);
 * - existe cópia local não sincronizada no IndexedDB (texto nunca fica escondido);
 * - o rascunho do servidor muda nesta tela (adendo/reabrir navegando para a mesma página).
 */
export function FichaProvider({
  internacaoId,
  userId,
  rascunhoId,
  children,
}: {
  internacaoId: string
  userId: string
  rascunhoId: string | null
  children: ReactNode
}) {
  const [aberta, setAberta] = useState(false)
  const [foco, setFoco] = useState(false)
  const [rascunhoAnterior, setRascunhoAnterior] = useState(rascunhoId)

  const abrir = useCallback((opcoes?: { foco?: boolean }) => {
    setFoco(Boolean(opcoes?.foco))
    setAberta(true)
  }, [])

  // Rascunho que surge ou troca depois do carregamento (criar adendo/reabrir sem recarregar a página): abre.
  if (rascunhoId !== rascunhoAnterior) {
    setRascunhoAnterior(rascunhoId)
    if (rascunhoId) setAberta(true)
  }

  useEffect(() => {
    const aoMudarHash = () => {
      if (window.location.hash === '#ficha') setAberta(true)
    }
    aoMudarHash()
    window.addEventListener('hashchange', aoMudarHash)
    return () => window.removeEventListener('hashchange', aoMudarHash)
  }, [])

  useEffect(() => {
    let vivo = true
    armazenamentoIdb()
      .get(`rascunho:${internacaoId}:${userId}`)
      .then((local) => {
        if (vivo && local && local.sincronizado !== true) setAberta(true)
      })
      .catch(() => {})
    return () => {
      vivo = false
    }
  }, [internacaoId, userId])

  return <FichaContexto value={{ aberta, foco, abrir }}>{children}</FichaContexto>
}

/** Botão da barra de ações: abre a ficha. Com rascunho do servidor vira "Continuar evolução" e mostra a hora. */
export function BotaoNovaEvolucao({ rascunhoHora }: { rascunhoHora: string | null }) {
  const { aberta, abrir } = useFicha()
  if (aberta) return null
  return (
    <>
      {rascunhoHora && (
        <span role="status" className="text-[13px] font-semibold text-muted-foreground">
          Rascunho salvo às {rascunhoHora}
        </span>
      )}
      <Button type="button" size="compacto" variant="primaria" onClick={() => abrir({ foco: true })}>
        <Plus aria-hidden />
        {rascunhoHora ? 'Continuar evolução' : 'Nova evolução'}
      </Button>
    </>
  )
}

/** A ficha em si: só existe aberta. Ao montar, rola até ela e, se foi clique, foca o primeiro campo. */
export function AreaFicha({ children }: { children: ReactNode }) {
  const { aberta, foco } = useFicha()
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!aberta) return
    const el = ref.current
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    if (foco) el.querySelector<HTMLElement>('textarea, input')?.focus({ preventScroll: true })
  }, [aberta, foco])
  if (!aberta) return null
  return (
    <div id="ficha" ref={ref} className="min-w-0 scroll-mt-4">
      {children}
    </div>
  )
}

/** Espaço do rodapé fixo da ficha no celular; só com a ficha aberta. */
export function EspacoRodapeFicha() {
  const { aberta } = useFicha()
  return aberta ? <div aria-hidden className="h-[calc(6rem+env(safe-area-inset-bottom))] sm:hidden" /> : null
}
