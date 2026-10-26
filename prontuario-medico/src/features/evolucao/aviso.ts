/** Avisos de conclusão de evolução, carregados na URL da lista de Internados (`?aviso=`). */
const AVISOS = {
  finalizada: 'Evolução finalizada.',
  enviada: 'Evolução enviada para validação.',
} as const

export type ChaveAviso = keyof typeof AVISOS

/** Só os valores conhecidos viram mensagem; texto arbitrário da URL é ignorado. */
export function mensagemDoAviso(valor: string | null | undefined): string | null {
  if (valor === 'finalizada' || valor === 'enviada') return AVISOS[valor]
  return null
}
