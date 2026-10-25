import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/database.types'

export type LinhaInternacao = Database['public']['Views']['vw_internacoes_lista']['Row']

export async function listarInternacoes(f: {
  status: 'INTERNADO' | 'ALTA'
  equipeId?: string
}): Promise<LinhaInternacao[]> {
  const supabase = await createClient()
  let consulta = supabase.from('vw_internacoes_lista').select('*').eq('status', f.status)
  if (f.equipeId) consulta = consulta.eq('equipe_id', f.equipeId)
  const { data, error } = await consulta.order('leito_ala').order('nome')
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function listarEquipes(): Promise<{ id: string; nome: string }[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('equipes')
    .select('id, nome')
    .eq('ativo', true)
    .order('nome')
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function listarMedicos(): Promise<{ id: string; nome: string }[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('vw_profissionais_publico')
    .select('id, nome')
    .eq('perfil', 'medico')
    .order('nome')
  if (error) throw new Error(error.message)
  return (data ?? []).map((m) => ({ id: m.id, nome: m.nome }))
}
