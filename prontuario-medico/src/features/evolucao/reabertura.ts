/** Prazo para o autor reabrir a própria evolução finalizada (o banco aplica a mesma regra). */
export const PRAZO_REABERTURA_MS = 15 * 60 * 1000

export type EvolucaoReabrivel = {
  id: string
  status: string
  autor_id: string
  validada_por: string | null
  adendo_de: string | null
  finalizada_em: string | null
  vias_impressas: number | null
}

/**
 * Espelho de public.reabrir_evolucao para decidir se o botão aparece. A função do banco continua
 * sendo a autoridade: aqui só se evita mostrar o botão onde ela recusaria de forma previsível.
 * `todas` são as evoluções visíveis da internação.
 */
export function podeReabrir(
  evolucao: EvolucaoReabrivel,
  todas: EvolucaoReabrivel[],
  ctx: { perfil: string; usuarioId: string; internacaoInternada: boolean; temRascunhoProprio: boolean; agora: Date },
): boolean {
  if (ctx.perfil !== 'medico' || evolucao.autor_id !== ctx.usuarioId) return false
  if (evolucao.status !== 'FINALIZADA' || evolucao.adendo_de || !evolucao.finalizada_em) return false
  if (evolucao.validada_por !== evolucao.autor_id) return false
  if (ctx.agora.getTime() - new Date(evolucao.finalizada_em).getTime() >= PRAZO_REABERTURA_MS) return false
  if ((evolucao.vias_impressas ?? 0) > 0) return false
  if (!ctx.internacaoInternada || ctx.temRascunhoProprio) return false
  const finalizadaEm = new Date(evolucao.finalizada_em).getTime()
  return !todas.some(
    (o) =>
      o.id !== evolucao.id &&
      ((o.status === 'FINALIZADA' && o.finalizada_em !== null && new Date(o.finalizada_em).getTime() >= finalizadaEm) ||
        o.adendo_de === evolucao.id),
  )
}

/** Horário (hh:mm, America/Sao_Paulo) até o qual a evolução pode ser reaberta. */
export function horaLimiteReabertura(finalizadaEm: string): string {
  return new Date(new Date(finalizadaEm).getTime() + PRAZO_REABERTURA_MS).toLocaleTimeString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
  })
}
