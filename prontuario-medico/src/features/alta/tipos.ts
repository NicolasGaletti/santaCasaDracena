export const TIPOS_ALTA = ['MELHORADA', 'CURADA', 'A_PEDIDO', 'TRANSFERENCIA', 'EVASAO', 'OBITO'] as const
export type TipoAlta = (typeof TIPOS_ALTA)[number]

export const ROTULO_TIPO_ALTA: Record<TipoAlta, string> = {
  MELHORADA: 'Melhorada',
  CURADA: 'Curada',
  A_PEDIDO: 'A pedido',
  TRANSFERENCIA: 'Transferência',
  EVASAO: 'Evasão',
  OBITO: 'Óbito',
}

export function ehTipoAlta(valor: unknown): valor is TipoAlta {
  return typeof valor === 'string' && (TIPOS_ALTA as readonly string[]).includes(valor)
}

export function rotuloTipoAlta(valor: string | null | undefined): string {
  return ehTipoAlta(valor) ? ROTULO_TIPO_ALTA[valor] : '—'
}
