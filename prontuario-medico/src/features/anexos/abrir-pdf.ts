import { urlAssinada } from './actions'

/**
 * Abre o PDF em nova aba com uma URL assinada gerada na hora (a prévia pode ter expirado).
 * A aba é aberta antes do pedido para não ser bloqueada como pop-up. Devolve a mensagem de erro, se houver.
 */
export async function abrirPdfEmNovaAba(anexoId: string): Promise<string | undefined> {
  const janela = window.open('', '_blank')
  const { url, erro } = await urlAssinada(anexoId)
  if (!url) {
    janela?.close()
    return erro ?? 'Não foi possível abrir o PDF. Tente novamente.'
  }
  if (janela) {
    janela.location.href = url
  } else {
    window.open(url, '_blank', 'noopener')
  }
  return undefined
}
