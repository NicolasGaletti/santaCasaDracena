import type { FilaAutosave } from './autosave'

/** Aviso de anexo não enviado: a mensagem nomeia a ação que foi bloqueada. */
export function mensagemAnexoNaoEnviado(acao: 'finalizar' | 'enviar'): string {
  return `Há anexo não enviado. Envie de novo ou cancele antes de ${acao}.`
}

export const MENSAGEM_SEM_CONEXAO_ENVIO =
  'Sem conexão: a evolução não foi enviada. Ela continua salva neste aparelho; tente de novo quando a conexão voltar.'

/**
 * Envio para validação: garante que a versão mais nova do rascunho está no servidor e chama a ação.
 * Falha de salvamento vira `erro` (sem lançar). Erro de transporte ou redirecionamento da ação é propagado.
 */
export async function enviarEvolucao<D>(
  fila: FilaAutosave<D>,
  acao: (evolucaoId: string) => Promise<{ erro?: string } | undefined>,
): Promise<{ erro?: string }> {
  try {
    await fila.forcar()
  } catch {
    return { erro: fila.estado === 'erro' ? (fila.mensagemErro ?? MENSAGEM_SEM_CONEXAO_ENVIO) : MENSAGEM_SEM_CONEXAO_ENVIO }
  }
  const evolucaoId = fila.evolucaoId
  if (!evolucaoId) return { erro: 'Não foi possível localizar o rascunho. Tente novamente.' }
  return (await acao(evolucaoId)) ?? {}
}

/** Redirecionamento do Next chega como erro com digest `NEXT_REDIRECT`: é sucesso, não se trata. */
export function ehRedirecionamento(erro: unknown): boolean {
  return typeof erro === 'object' && erro !== null && String((erro as { digest?: unknown }).digest ?? '').startsWith('NEXT_REDIRECT')
}
