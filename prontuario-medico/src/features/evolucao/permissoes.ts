import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'

/**
 * Residente só evolui em internação de equipe da qual é membro.
 * Médico evolui em qualquer internação ativa (regra de acesso fica no banco).
 */
export async function podeEvoluirNaInternacao(
  supabase: SupabaseClient<Database>,
  perfil: string,
  profissionalId: string,
  equipeId: string | null,
): Promise<boolean> {
  if (perfil === 'medico') return true
  if (perfil !== 'residente' || !equipeId) return false
  const { data } = await supabase
    .from('membros_equipe')
    .select('equipe_id')
    .eq('equipe_id', equipeId)
    .eq('profissional_id', profissionalId)
    .maybeSingle()
  return Boolean(data)
}
