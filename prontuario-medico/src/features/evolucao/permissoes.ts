import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'

/** Perfis que registram evolução. Médico escreve com o modelo médico; os demais, com o da categoria. */
export const PERFIS_QUE_EVOLUEM = ['medico', 'residente', 'academico', 'multiprofissional'] as const

/** Perfis que só evoluem em internação de equipe da qual são membros. */
const PERFIS_POR_EQUIPE: readonly string[] = ['residente', 'academico', 'multiprofissional']

/** Conselho exigido para registrar (acadêmico não tem conselho). */
export function exigeConselho(perfil: string): boolean {
  return perfil !== 'academico'
}

/**
 * Residente, acadêmico e multiprofissional só evoluem em internação de equipe da qual são membros.
 * Médico evolui em qualquer internação ativa (regra de acesso fica no banco).
 */
export async function podeEvoluirNaInternacao(
  supabase: SupabaseClient<Database>,
  perfil: string,
  profissionalId: string,
  equipeId: string | null,
): Promise<boolean> {
  if (perfil === 'medico') return true
  if (!PERFIS_POR_EQUIPE.includes(perfil) || !equipeId) return false
  return ehMembroDaEquipe(supabase, profissionalId, equipeId)
}

export async function ehMembroDaEquipe(
  supabase: SupabaseClient<Database>,
  profissionalId: string,
  equipeId: string | null,
): Promise<boolean> {
  if (!equipeId) return false
  const { data } = await supabase
    .from('membros_equipe')
    .select('equipe_id')
    .eq('equipe_id', equipeId)
    .eq('profissional_id', profissionalId)
    .maybeSingle()
  return Boolean(data)
}

/**
 * Adendo: o autor da evolução original, ou médico membro da equipe da internação.
 * Só perfis que evoluem; a regra de internação em alta e a de rascunho aberto ficam no banco.
 */
export function podeCriarAdendo(perfil: string, ehAutor: boolean, ehMembroEquipe: boolean): boolean {
  if (!(PERFIS_QUE_EVOLUEM as readonly string[]).includes(perfil)) return false
  return ehAutor || (perfil === 'medico' && ehMembroEquipe)
}

/** Multiprofissional sem categoria não consegue registrar evolução (o banco recusa). */
export function categoriaAusente(perfil: string, categoria: string | null): boolean {
  return perfil === 'multiprofissional' && !categoria
}
