'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { criarAdendo } from './actions'
import { ehRedirecionamento } from './envio'

const MENSAGEM_GENERICA = 'Não foi possível criar o adendo. Tente novamente.'

/** Abre o adendo; o erro de negócio (P0001) aparece no próprio cartão. */
export function BotaoAdendo({ evolucaoId }: { evolucaoId: string }) {
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  // Trava síncrona: dois cliques no mesmo instante não criam dois rascunhos.
  const travado = useRef(false)

  async function criar() {
    if (travado.current) return
    travado.current = true
    setEnviando(true)
    setErro(null)
    try {
      const resultado = await criarAdendo(evolucaoId)
      if (resultado?.erro) {
        setErro(resultado.erro)
        travado.current = false
        setEnviando(false)
      }
    } catch (erroAcao) {
      // Redirecionamento para o formulário = sucesso: mantém a trava até a navegação.
      if (ehRedirecionamento(erroAcao)) return
      setErro(MENSAGEM_GENERICA)
      travado.current = false
      setEnviando(false)
    }
  }

  return (
    // Fragmento: o botão fica na fila do rodapé e o erro ocupa a linha inteira abaixo dela (basis-full).
    <>
      <Button type="button" variant="outline" className="min-h-11" disabled={enviando} onClick={criar}>
        Adendo
      </Button>
      {erro && (
        <p role="alert" className="w-full basis-full rounded-lg bg-destructive-soft p-3 text-sm font-semibold text-destructive-soft-foreground">
          {erro}
        </p>
      )}
    </>
  )
}
