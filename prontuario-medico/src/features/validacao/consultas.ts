import { exigirProfissional } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import type { AnexoGaleria } from '@/features/anexos/consultas'
import type { EvolucaoTimeline } from '@/features/evolucao/cartao-evolucao'
import type { LinhaInternacao } from '@/features/internacoes/consultas'
import { rotuloIdentificacao } from '@/lib/rotulos-perfil'

/** Evolução aguardando validação, na lista do médico. */
export type PendenteValidacao = {
  id: string
  internacaoId: string
  pacienteNome: string
  leito: string
  equipeNome: string
  categoria: string
  autorNome: string
  enviadaEm: string
  adendoDe: string | null
}

/** Evolução completa para revisão, com a linha da internação e a identificação do autor. */
export type RevisaoValidacao = {
  evolucao: EvolucaoTimeline
  internacao: LinhaInternacao
  autorIdentificacao: string
  anexos: AnexoGaleria[]
}

/**
 * Pendentes visíveis ao médico (a RLS restringe às equipes dele), sem as próprias, mais antigas primeiro.
 */
export async function listarPendentes(): Promise<PendenteValidacao[]> {
  const profissional = await exigirProfissional()
  const supabase = await createClient()

  const { data: evolucoes } = await supabase
    .from('vw_evolucoes_timeline')
    .select('id, internacao_id, categoria, autor_nome, enviada_em, adendo_de')
    .eq('status', 'AGUARDANDO_VALIDACAO')
    .neq('autor_id', profissional.id)
    .order('enviada_em', { ascending: true })
  if (!evolucoes || evolucoes.length === 0) return []

  const internacaoIds = [...new Set(evolucoes.map((e) => e.internacao_id))]
  const { data: internacoes } = await supabase
    .from('vw_internacoes_lista')
    .select('internacao_id, nome, leito_ala, equipe_nome')
    .in('internacao_id', internacaoIds)
  const porInternacao = new Map((internacoes ?? []).map((i) => [i.internacao_id, i]))

  return evolucoes.flatMap((e) => {
    const internacao = porInternacao.get(e.internacao_id)
    if (!e.id || !e.internacao_id || !internacao) return []
    return [
      {
        id: e.id,
        internacaoId: e.internacao_id,
        pacienteNome: internacao.nome ?? '',
        leito: internacao.leito_ala ?? '',
        equipeNome: internacao.equipe_nome ?? '',
        categoria: e.categoria ?? '',
        autorNome: e.autor_nome ?? 'Autor não identificado',
        enviadaEm: e.enviada_em ?? '',
        adendoDe: e.adendo_de ?? null,
      },
    ]
  })
}

/** Número de pendentes para o contador da aba "Validar" (sem as próprias). */
export async function contarPendentes(): Promise<number> {
  const profissional = await exigirProfissional()
  const supabase = await createClient()

  const { count } = await supabase
    .from('vw_evolucoes_timeline')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'AGUARDANDO_VALIDACAO')
    .neq('autor_id', profissional.id)
  return count ?? 0
}

/**
 * Revisão de uma evolução aguardando validação. Devolve null quando a RLS não mostra a evolução
 * (outra equipe, ou não está aguardando validação), para a página responder 404.
 */
export async function buscarRevisao(evolucaoId: string): Promise<RevisaoValidacao | null> {
  const profissional = await exigirProfissional()
  const supabase = await createClient()

  // Própria evolução não se valida: some da tela (404), como uma evolução que a RLS esconde.
  const { data: evolucao } = await supabase
    .from('vw_evolucoes_timeline')
    .select('id, internacao_id, status, categoria, autor_id, autor_nome, criado_em, finalizada_em, dados, texto_livre, qtd_anexos')
    .eq('id', evolucaoId)
    .eq('status', 'AGUARDANDO_VALIDACAO')
    .neq('autor_id', profissional.id)
    .maybeSingle()
  if (!evolucao || !evolucao.id || !evolucao.internacao_id || !evolucao.autor_id) return null

  const { data: internacao } = await supabase
    .from('vw_internacoes_lista')
    .select('*')
    .eq('internacao_id', evolucao.internacao_id)
    .maybeSingle()
  if (!internacao) return null

  const { data: autor } = await supabase
    .from('vw_profissionais_publico')
    .select('perfil, categoria, conselho, numero_conselho, uf_conselho')
    .eq('id', evolucao.autor_id)
    .maybeSingle()

  const { data: anexos } = await supabase
    .from('anexos')
    .select('id, tipo, descricao, data_exame, mime, evolucao_id')
    .eq('evolucao_id', evolucao.id)
    .eq('confirmado', true)
    .order('data_exame', { ascending: false })
    .order('enviado_em', { ascending: false })

  return {
    evolucao: {
      id: evolucao.id,
      status: 'AGUARDANDO_VALIDACAO',
      categoria: evolucao.categoria ?? '',
      autor_nome: evolucao.autor_nome,
      criado_em: evolucao.criado_em ?? '',
      finalizada_em: evolucao.finalizada_em,
      dados: evolucao.dados,
      texto_livre: evolucao.texto_livre ?? '',
      qtd_anexos: evolucao.qtd_anexos,
    },
    internacao,
    autorIdentificacao: autor
      ? rotuloIdentificacao({
          perfil: autor.perfil ?? '',
          categoria: autor.categoria,
          conselho: autor.conselho,
          numero_conselho: autor.numero_conselho,
          uf_conselho: autor.uf_conselho,
        })
      : '',
    anexos: (anexos ?? []).map((a) => ({
      id: a.id,
      tipo: a.tipo,
      descricao: a.descricao,
      dataExame: a.data_exame,
      mime: a.mime,
      evolucaoId: a.evolucao_id,
      autorNome: evolucao.autor_nome ?? '',
    })),
  }
}
