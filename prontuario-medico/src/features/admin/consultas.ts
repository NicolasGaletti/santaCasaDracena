import { createClient } from '@/lib/supabase/server'

export type ProfissionalAdmin = {
  id: string
  nome: string
  perfil: string
  categoria: string | null
  conselho: string | null
  numero_conselho: string | null
  uf_conselho: string | null
  ativo: boolean
  email: string | null
  convite_pendente: boolean
  equipe_ids: string[]
}

export type EquipeAdmin = { id: string; nome: string; ativo: boolean }

export async function listarProfissionaisAdmin(): Promise<ProfissionalAdmin[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('admin_listar_profissionais')
  if (error) throw new Error(error.message)
  // Os tipos gerados tratam colunas anuláveis do retorno de função como não anuláveis.
  return (data ?? []) as ProfissionalAdmin[]
}

export async function listarEquipesAdmin(): Promise<EquipeAdmin[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('equipes').select('id, nome, ativo').order('nome')
  if (error) throw new Error(error.message)
  return data ?? []
}
