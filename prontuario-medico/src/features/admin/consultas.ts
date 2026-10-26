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

export type ConvenioAdmin = { id: string; nome: string; ativo: boolean; usos: number }

export async function listarConveniosAdmin(): Promise<ConvenioAdmin[]> {
  const supabase = await createClient()
  const [{ data: todos, error }, { data: ativos, error: erroAtivos }] = await Promise.all([
    supabase.from('convenios').select('id, nome, ativo').order('nome'),
    supabase.from('vw_convenios_ordenados').select('id, usos'),
  ])
  if (error) throw new Error(error.message)
  if (erroAtivos) throw new Error(erroAtivos.message)
  const usosAtivos = new Map((ativos ?? []).map((c) => [c.id, c.usos ?? 0]))
  return Promise.all(
    (todos ?? []).map(async (c) => {
      if (c.ativo) return { ...c, usos: usosAtivos.get(c.id) ?? 0 }
      // A view lista só convênios ativos; os desativados são contados à parte (sem curingas do ilike).
      const { count } = await supabase
        .from('pacientes')
        .select('id', { count: 'exact', head: true })
        .ilike('convenio', c.nome.trim().replace(/[\\%_]/g, '\\$&'))
      return { ...c, usos: count ?? 0 }
    }),
  )
}
