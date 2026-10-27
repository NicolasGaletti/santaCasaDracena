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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Id da internação carregado no aviso (`?internacao=`); fora do formato UUID vira null. */
export function internacaoDoAviso(valor: string | null | undefined): string | null {
  return valor && UUID.test(valor) ? valor : null
}
