export type NotificacaoLink = {
  tipo: string
  internacao_id: string | null
  evolucao_id: string | null
}

/** Destino ao abrir uma notificação: validação leva à revisão; o resto, ao prontuário. */
export function destinoNotificacao(n: NotificacaoLink): string {
  if (n.tipo === 'validacao_pendente' && n.evolucao_id) return `/validacao?evolucao=${n.evolucao_id}`
  if (n.internacao_id) return `/internacoes/${n.internacao_id}`
  return '/notificacoes'
}
