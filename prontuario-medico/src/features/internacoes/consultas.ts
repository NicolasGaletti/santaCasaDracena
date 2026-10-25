import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/database.types'

export type LinhaInternacao = Database['public']['Views']['vw_internacoes_lista']['Row']

export async function listarInternacoes(f: {
  status: 'INTERNADO' | 'ALTA'
  equipeId?: string
  convenio?: string
}): Promise<LinhaInternacao[]> {
  const supabase = await createClient()
  let consulta = supabase.from('vw_internacoes_lista').select('*').eq('status', f.status)
  if (f.equipeId) consulta = consulta.eq('equipe_id', f.equipeId)
  if (f.convenio) consulta = consulta.eq('convenio', f.convenio)
  const { data, error } = await consulta
  if (error) throw new Error(error.message)
  return (data ?? []).sort(
    (a, b) => ordenadorLeito.compare(a.leito_ala, b.leito_ala) || a.nome.localeCompare(b.nome, 'pt-BR'),
  )
}

// Ordem natural do leito: "A-2" vem antes de "A-10".
const ordenadorLeito = new Intl.Collator('pt-BR', { numeric: true, sensitivity: 'base' })

/** Convênios presentes na lista do status, em ordem alfabética (sem repetição). */
export async function listarConvenios(status: 'INTERNADO' | 'ALTA'): Promise<string[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('vw_internacoes_lista').select('convenio').eq('status', status)
  if (error) throw new Error(error.message)
  const nomes = new Set((data ?? []).map((l) => l.convenio).filter((c): c is string => Boolean(c)))
  return [...nomes].sort((a, b) => a.localeCompare(b, 'pt-BR'))
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
    .eq('ativo', true)
    .order('nome')
  if (error) throw new Error(error.message)
  return (data ?? []).map((m) => ({ id: m.id, nome: m.nome }))
}
