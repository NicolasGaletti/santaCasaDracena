'use client'

import { Button } from '@/components/ui/button'

/**
 * Cada clique gera uma chave nova: reimpressão deliberada vira 2ª via; recarregar o PDF não vira.
 * `comImagens` acrescenta uma página por imagem anexada.
 */
export function BotaoImprimirEvolucao({ evolucaoId, comImagens = false }: { evolucaoId: string; comImagens?: boolean }) {
  const url = (chave?: string) => {
    const params = new URLSearchParams()
    if (chave) params.set('k', chave)
    if (comImagens) params.set('anexos', '1')
    const query = params.toString()
    return `/evolucoes/${evolucaoId}/pdf${query ? `?${query}` : ''}`
  }
  return (
    <Button asChild variant="outline" className="min-h-11">
      <a
        href={url()}
        target="_blank"
        rel="noopener"
        onClick={(e) => {
          e.preventDefault()
          window.open(url(crypto.randomUUID()), '_blank', 'noopener')
        }}
      >
        {comImagens ? 'Imprimir com imagens' : 'Imprimir'}
      </a>
    </Button>
  )
}
