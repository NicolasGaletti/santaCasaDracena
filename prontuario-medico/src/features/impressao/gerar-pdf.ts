import { renderToBuffer } from '@react-pdf/renderer'
import { lerDadosMedica } from '@/features/evolucao/cartao-evolucao'
import { createClient } from '@/lib/supabase/server'
import {
  codigoCurto,
  DocumentoEvolucao,
  type Assinante,
  type EvolucaoImpressao,
} from './documento-evolucao'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAXIMO_IDS = 50
const PERFIS_NAO_CLINICOS = ['recepcao', 'admin']

const cabecalhos = (extra: Record<string, string> = {}) => ({
  'Cache-Control': 'no-store',
  ...extra,
})

function erro(status: number, mensagem: string): Response {
  return Response.json({ erro: mensagem }, { status, headers: cabecalhos() })
}

function assinante(json: unknown): Assinante | null {
  if (!json || typeof json !== 'object') return null
  const obj = json as Record<string, unknown>
  const texto = (v: unknown) => (typeof v === 'string' && v.trim() !== '' ? v : null)
  const nome = texto(obj.nome)
  if (!nome) return null
  return { nome, conselho: texto(obj.conselho), numero: texto(obj.numero), uf: texto(obj.uf) }
}

/**
 * Gera um PDF A4 com as evoluções finalizadas pedidas, na ordem dos ids.
 * Cada evolução ganha um número de via: registrar_impressao roda uma vez por evolução e o
 * valor devolvido é o que aparece no documento.
 */
export async function gerarPdf(ids: string[]): Promise<Response> {
  if (ids.length === 0 || ids.length > MAXIMO_IDS) return erro(400, 'Informe de 1 a 50 evoluções.')
  if (ids.some((id) => !UUID.test(id))) return erro(400, 'Identificador de evolução inválido.')
  if (new Set(ids).size !== ids.length) return erro(400, 'Evolução repetida na lista.')

  const supabase = await createClient()
  const { data: claims } = await supabase.auth.getClaims()
  const userId = claims?.claims.sub
  if (!userId) return erro(401, 'Não autenticado.')

  const { data: profissional } = await supabase
    .from('profissionais')
    .select('id, perfil, ativo')
    .eq('id', userId)
    .maybeSingle()
  if (!profissional?.ativo) return erro(401, 'Não autenticado.')
  if (PERFIS_NAO_CLINICOS.includes(profissional.perfil)) {
    return erro(403, 'Acesso restrito a profissionais clínicos.')
  }

  const { data: evolucoes, error: erroEvolucoes } = await supabase
    .from('vw_evolucoes_timeline')
    .select(
      'id, internacao_id, categoria, status, dados, finalizada_em, validada_em, snapshot_autor, snapshot_validador, conteudo_hash',
    )
    .in('id', ids)
  if (erroEvolucoes) return erro(500, 'Não foi possível gerar o PDF.')

  const porId = new Map((evolucoes ?? []).map((e) => [e.id, e]))
  const naoEncontrada = 'Evolução não encontrada ou ainda não finalizada.'
  if (ids.some((id) => porId.get(id)?.status !== 'FINALIZADA')) return erro(404, naoEncontrada)

  const internacaoIds = [...new Set((evolucoes ?? []).map((e) => e.internacao_id))]
  const { data: internacoes, error: erroInternacoes } = await supabase
    .from('vw_internacoes_lista')
    .select('internacao_id, nome, data_nascimento, convenio, leito_ala, equipe_nome, medico_responsavel_nome')
    .in('internacao_id', internacaoIds)
  if (erroInternacoes) return erro(500, 'Não foi possível gerar o PDF.')
  const internacaoPorId = new Map((internacoes ?? []).map((i) => [i.internacao_id, i]))

  const vias: number[] = []
  for (const id of ids) {
    const { data: via, error } = await supabase.rpc('registrar_impressao', { p_evolucao_id: id })
    if (error) return error.code === 'P0001' ? erro(404, naoEncontrada) : erro(500, 'Não foi possível registrar a impressão.')
    vias.push(via)
  }

  const itens: EvolucaoImpressao[] = []
  for (const [indice, id] of ids.entries()) {
    const evolucao = porId.get(id)
    const internacao = evolucao && internacaoPorId.get(evolucao.internacao_id)
    if (!evolucao || !evolucao.finalizada_em || !internacao || !internacao.nome) {
      return erro(404, naoEncontrada)
    }
    itens.push({
      evolucao: {
        id,
        categoria: evolucao.categoria,
        dados: lerDadosMedica(evolucao.dados),
        finalizada_em: evolucao.finalizada_em,
        validada_em: evolucao.validada_em,
        snapshot_autor: assinante(evolucao.snapshot_autor),
        snapshot_validador: assinante(evolucao.snapshot_validador),
        conteudo_hash: evolucao.conteudo_hash,
      },
      internacao: {
        leito_ala: internacao.leito_ala ?? '',
        equipe_nome: internacao.equipe_nome ?? '',
        medico_responsavel_nome: internacao.medico_responsavel_nome,
      },
      paciente: {
        nome: internacao.nome,
        data_nascimento: internacao.data_nascimento ?? '',
        convenio: internacao.convenio ?? '',
      },
      via: vias[indice],
    })
  }

  const buffer = await renderToBuffer(DocumentoEvolucao({ evolucoes: itens }))
  const nome = ids.length === 1 ? `evolucao-${codigoCurto(ids[0])}.pdf` : `evolucoes-${ids.length}.pdf`

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: cabecalhos({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${nome}"`,
    }),
  })
}
