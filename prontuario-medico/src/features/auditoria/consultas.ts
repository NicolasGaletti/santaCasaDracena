import { createClient } from '@/lib/supabase/server'
import { limitesPeriodo, TAMANHO_PAGINA, type FiltrosAuditoria } from './funcoes'

export type LinhaAcesso = {
  id: string
  em: string
  acao: string
  profissional: string
  paciente: string
  internacaoId: string
}

export type LinhaAlteracao = {
  id: string
  em: string
  por: string | null
  tabela: string
  operacao: string
  antes: unknown
  depois: unknown
}

export type Pagina<T> = { linhas: T[]; total: number }

async function nomesProfissionais(ids: string[]): Promise<Map<string, string>> {
  const supabase = await createClient()
  const unicos = [...new Set(ids)]
  if (unicos.length === 0) return new Map()
  const { data } = await supabase.from('vw_profissionais_publico').select('id, nome').in('id', unicos)
  return new Map((data ?? []).map((p) => [p.id as string, p.nome as string]))
}

export async function listarProfissionaisFiltro(): Promise<{ id: string; nome: string }[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('vw_profissionais_publico').select('id, nome').order('nome')
  return (data ?? []).map((p) => ({ id: p.id as string, nome: p.nome as string }))
}

export async function listarAcessos(f: FiltrosAuditoria): Promise<Pagina<LinhaAcesso>> {
  const supabase = await createClient()
  const { inicio, fim } = limitesPeriodo(f.de, f.ate)
  let q = supabase
    .from('acessos')
    .select('id, em, acao, profissional_id, internacao_id, internacoes(pacientes(nome))', { count: 'exact' })
    .order('em', { ascending: false })
    .order('id', { ascending: false })
  if (inicio) q = q.gte('em', inicio)
  if (fim) q = q.lt('em', fim)
  if (f.profissional) q = q.eq('profissional_id', f.profissional)
  const de = (f.pagina - 1) * TAMANHO_PAGINA
  const { data, count, error } = await q.range(de, de + TAMANHO_PAGINA - 1)
  if (error) {
    if (error.code === 'PGRST103') return { linhas: [], total: 0 } // página além do fim
    throw new Error(error.message)
  }
  const nomes = await nomesProfissionais((data ?? []).map((a) => a.profissional_id))
  return {
    total: count ?? 0,
    linhas: (data ?? []).map((a) => {
      const internacao = a.internacoes as unknown as { pacientes: { nome: string } | null } | null
      return {
        id: a.id,
        em: a.em,
        acao: a.acao,
        profissional: nomes.get(a.profissional_id) ?? 'Profissional desconhecido',
        paciente: internacao?.pacientes?.nome ?? `Internação ${a.internacao_id.slice(0, 8)}`,
        internacaoId: a.internacao_id,
      }
    }),
  }
}

export async function listarAlteracoes(f: FiltrosAuditoria): Promise<Pagina<LinhaAlteracao & { quem: string }>> {
  const supabase = await createClient()
  const { inicio, fim } = limitesPeriodo(f.de, f.ate)
  let q = supabase
    .from('auditoria')
    .select('id, em, por, tabela, operacao, antes, depois', { count: 'exact' })
    .order('em', { ascending: false })
    .order('id', { ascending: false })
  if (inicio) q = q.gte('em', inicio)
  if (fim) q = q.lt('em', fim)
  if (f.profissional) q = q.eq('por', f.profissional)
  const de = (f.pagina - 1) * TAMANHO_PAGINA
  const { data, count, error } = await q.range(de, de + TAMANHO_PAGINA - 1)
  if (error) {
    if (error.code === 'PGRST103') return { linhas: [], total: 0 }
    throw new Error(error.message)
  }
  const nomes = await nomesProfissionais((data ?? []).flatMap((a) => (a.por ? [a.por] : [])))
  return {
    total: count ?? 0,
    linhas: (data ?? []).map((a) => ({
      ...a,
      quem: a.por ? (nomes.get(a.por) ?? 'Profissional desconhecido') : 'Sistema',
    })),
  }
}
