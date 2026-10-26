import { createClient } from '@/lib/supabase/server'

export type Notificacao = {
  id: string
  tipo: string
  internacao_id: string | null
  evolucao_id: string | null
  texto: string
  lida_em: string | null
  criada_em: string
}

export async function contarNaoLidas(): Promise<number> {
  const supabase = await createClient()
  const { count } = await supabase.from('notificacoes').select('id', { count: 'exact', head: true }).is('lida_em', null)
  return count ?? 0
}

export async function listarNotificacoes(): Promise<Notificacao[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('notificacoes')
    .select('id, tipo, internacao_id, evolucao_id, texto, lida_em, criada_em')
    .order('criada_em', { ascending: false })
    .limit(100)
  return data ?? []
}

/** Linha ausente = os dois avisos ligados. */
export async function lerPreferencias(): Promise<{ pushValidacao: boolean; pushDevolvida: boolean }> {
  const supabase = await createClient()
  const { data } = await supabase.from('preferencias_notificacao').select('push_validacao, push_devolvida').maybeSingle()
  return { pushValidacao: data?.push_validacao ?? true, pushDevolvida: data?.push_devolvida ?? true }
}
