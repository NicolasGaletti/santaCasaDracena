import type { Database } from '@/lib/supabase/database.types'

type Perfil = Database['public']['Enums']['perfil_profissional']
type Categoria = Database['public']['Enums']['categoria_evolucao']

export type Funcao = {
  valor: string
  rotulo: string
  perfil: Perfil
  categoria: Categoria | null
  /** Conselho sugerido; nulo = a função não tem conselho (campos ocultos). */
  conselho: string | null
}

/** As 12 funções da tela de convite (valores = corpo da Edge Function admin-usuarios). */
export const FUNCOES: readonly Funcao[] = [
  { valor: 'medico', rotulo: 'Médico', perfil: 'medico', categoria: null, conselho: 'CRM' },
  { valor: 'residente', rotulo: 'Residente', perfil: 'residente', categoria: null, conselho: 'CRM' },
  { valor: 'interno', rotulo: 'Interno', perfil: 'academico', categoria: null, conselho: null },
  { valor: 'enfermagem', rotulo: 'Enfermagem', perfil: 'multiprofissional', categoria: 'enfermagem', conselho: 'COREN' },
  { valor: 'fisioterapia', rotulo: 'Fisioterapia', perfil: 'multiprofissional', categoria: 'fisioterapia', conselho: 'CREFITO' },
  { valor: 'nutricao', rotulo: 'Nutrição', perfil: 'multiprofissional', categoria: 'nutricao', conselho: 'CRN' },
  { valor: 'psicologia', rotulo: 'Psicologia', perfil: 'multiprofissional', categoria: 'psicologia', conselho: 'CRP' },
  { valor: 'fonoaudiologia', rotulo: 'Fonoaudiologia', perfil: 'multiprofissional', categoria: 'fonoaudiologia', conselho: 'CRFa' },
  { valor: 'servico_social', rotulo: 'Serviço social', perfil: 'multiprofissional', categoria: 'servico_social', conselho: 'CRESS' },
  { valor: 'recepcao', rotulo: 'Recepção', perfil: 'recepcao', categoria: null, conselho: null },
  { valor: 'auditoria', rotulo: 'Auditoria', perfil: 'auditoria', categoria: null, conselho: null },
  { valor: 'admin', rotulo: 'Admin', perfil: 'admin', categoria: null, conselho: null },
]

export function funcaoPorValor(valor: string): Funcao | undefined {
  return FUNCOES.find((f) => f.valor === valor)
}

/** Função de um profissional já cadastrado (multiprofissional se distingue pela categoria). */
export function funcaoDe(perfil: string, categoria: string | null): Funcao | undefined {
  return FUNCOES.find(
    (f) => f.perfil === perfil && (perfil !== 'multiprofissional' || f.categoria === categoria),
  )
}
