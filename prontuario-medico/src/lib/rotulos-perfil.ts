import { ROTULO_CATEGORIA } from '@/features/evolucao/rotulos'

export const ROTULO_PERFIL: Record<string, string> = {
  medico: 'Médico(a)',
  residente: 'Residente',
  academico: 'Acadêmico(a) de Medicina',
  recepcao: 'Recepção',
  auditoria: 'Auditoria',
  admin: 'Administrador(a)',
}

type Identificacao = {
  perfil: string
  categoria?: string | null
  conselho?: string | null
  numero_conselho?: string | null
  uf_conselho?: string | null
}

/** Texto de identificação no cabeçalho: registro no conselho quando existe, senão o rótulo pt-BR do perfil. */
export function rotuloIdentificacao(p: Identificacao): string {
  if (p.conselho && p.numero_conselho) {
    return `${p.conselho} ${p.numero_conselho}${p.uf_conselho ? `/${p.uf_conselho}` : ''}`
  }
  if (p.perfil === 'multiprofissional') {
    return p.categoria ? (ROTULO_CATEGORIA[p.categoria] ?? p.categoria) : 'Multiprofissional'
  }
  return ROTULO_PERFIL[p.perfil] ?? 'Perfil não identificado'
}
