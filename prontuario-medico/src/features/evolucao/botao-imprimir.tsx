'use client'

import { Button } from '@/components/ui/button'

/** Cada clique gera uma chave nova: reimpressão deliberada vira 2ª via; recarregar o PDF não vira. */
export function BotaoImprimirEvolucao({ evolucaoId }: { evolucaoId: string }) {
  return (
    <Button asChild variant="outline" className="min-h-11">
      <a
        href={`/evolucoes/${evolucaoId}/pdf`}
        target="_blank"
        rel="noopener"
        onClick={(e) => {
          e.preventDefault()
          window.open(`/evolucoes/${evolucaoId}/pdf?k=${crypto.randomUUID()}`, '_blank', 'noopener')
        }}
      >
        Imprimir
      </a>
    </Button>
  )
}
