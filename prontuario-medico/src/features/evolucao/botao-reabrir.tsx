'use client'

import { useRef, useState } from 'react'
import { Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { reabrir } from './actions'
import { ehRedirecionamento } from './envio'

const MENSAGEM_GENERICA = 'Não foi possível reabrir a evolução. Tente novamente.'

/** Reabre a própria evolução recém-finalizada; o erro de negócio (P0001) aparece no próprio cartão. */
export function BotaoReabrir({ evolucaoId, ate }: { evolucaoId: string; ate: string }) {
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  // Trava síncrona: dois cliques no mesmo instante não disparam duas reaberturas.
  const travado = useRef(false)

  async function reabrirAgora() {
    if (travado.current) return
    travado.current = true
    setEnviando(true)
    setErro(null)
    try {
      const resultado = await reabrir(evolucaoId)
      if (resultado?.erro) {
        setErro(resultado.erro)
        travado.current = false
        setEnviando(false)
      }
    } catch (erroAcao) {
      // Redirecionamento para a ficha = sucesso: mantém a trava até a navegação.
      if (ehRedirecionamento(erroAcao)) return
      setErro(MENSAGEM_GENERICA)
      travado.current = false
      setEnviando(false)
    }
  }

  return (
    <>
      <Button type="button" variant="contorno-teal" size="compacto" disabled={enviando} onClick={reabrirAgora}>
        <Undo2 aria-hidden />
        Reabrir para editar
      </Button>
      <span className="text-[12px] text-muted-foreground">{`disponível até ${ate}`}</span>
      {erro && (
        <p role="alert" className="w-full basis-full rounded-lg bg-destructive-soft p-3 text-sm font-semibold text-destructive-soft-foreground">
          {erro}
        </p>
      )}
    </>
  )
}
