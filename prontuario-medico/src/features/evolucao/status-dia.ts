import type { TipoStatus } from '@/components/layout/barra-acoes'

export type EntradaStatusDia = {
  internacaoAlta: boolean
  rascunhoProprio: boolean
  /** O rascunho próprio foi devolvido pelo médico. */
  devolvidaParaMim: boolean
  aguardandoProprio: boolean
  /** Há evolução finalizada hoje, de qualquer autor. */
  finalizadaHoje: boolean
}

/** Estado do dia para o usuário atual; a ordem das verificações é a prioridade. */
export function statusDoDia(e: EntradaStatusDia): { tipo: TipoStatus; texto: string } {
  if (e.devolvidaParaMim) return { tipo: 'devolvida', texto: 'Devolvida' }
  if (e.rascunhoProprio) return { tipo: 'rascunho', texto: 'Rascunho' }
  if (e.aguardandoProprio) return { tipo: 'aguardando', texto: 'Aguardando validação' }
  if (e.internacaoAlta) return { tipo: 'alta', texto: 'Alta' }
  if (e.finalizadaHoje) return { tipo: 'finalizada', texto: 'Evoluído hoje' }
  return { tipo: 'nenhuma', texto: 'Sem evolução hoje' }
}
