import { renderToBuffer } from '@react-pdf/renderer'
import { PDFDocument } from 'pdf-lib'
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
const MENSAGEM_ACESSO_NEGADO = 'Acesso negado.'
const MENSAGEM_NAO_ENCONTRADA = 'Evolução não encontrada ou ainda não finalizada.'

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

/** Junta os PDFs de cada evolução numa página única sequencial. */
async function juntarPdfs(buffers: Buffer[]): Promise<Uint8Array> {
  const final = await PDFDocument.create()
  for (const buffer of buffers) {
    const origem = await PDFDocument.load(buffer)
    const paginas = await final.copyPages(origem, origem.getPageIndices())
    paginas.forEach((pagina) => final.addPage(pagina))
  }
  return final.save()
}

/**
 * Gera um PDF A4 com as evoluções finalizadas pedidas, na ordem dos ids.
 * Ordem: valida e monta tudo; registra as vias de uma vez (atômico); só então renderiza.
 * Cada evolução é paginada à parte ("Página x de y" é da própria evolução).
 */
export async function gerarPdf(ids: string[], chave: string | null = null): Promise<Response> {
  if (ids.length === 0 || ids.length > MAXIMO_IDS) return erro(400, 'Informe de 1 a 50 evoluções.')
  if (ids.some((id) => !UUID.test(id))) return erro(400, 'Identificador de evolução inválido.')
  if (new Set(ids).size !== ids.length) return erro(400, 'Evolução repetida na lista.')
  if (chave !== null && !UUID.test(chave)) return erro(400, 'Chave de impressão inválida.')

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
      'id, internacao_id, categoria, status, dados, texto_livre, finalizada_em, validada_em, snapshot_autor, snapshot_validador, conteudo_hash',
    )
    .in('id', ids)
  if (erroEvolucoes) return erro(500, 'Não foi possível gerar o PDF.')

  const porId = new Map((evolucoes ?? []).map((e) => [e.id, e]))
  const internacaoIds = [...new Set((evolucoes ?? []).map((e) => e.internacao_id))]
  const { data: internacoes, error: erroInternacoes } = await supabase
    .from('vw_internacoes_lista')
    .select('internacao_id, nome, data_nascimento, convenio, leito_ala, equipe_nome, medico_responsavel_nome')
    .in('internacao_id', internacaoIds)
  if (erroInternacoes) return erro(500, 'Não foi possível gerar o PDF.')
  const internacaoPorId = new Map((internacoes ?? []).map((i) => [i.internacao_id, i]))

  // Monta tudo antes de gravar qualquer via: qualquer dado faltante é 404, sem impressão registrada.
  const itens: Omit<EvolucaoImpressao, 'via'>[] = []
  for (const id of ids) {
    const evolucao = porId.get(id)
    if (!evolucao || evolucao.status !== 'FINALIZADA' || !evolucao.finalizada_em) {
      return erro(404, MENSAGEM_NAO_ENCONTRADA)
    }
    const internacao = internacaoPorId.get(evolucao.internacao_id)
    if (!internacao || !internacao.nome) return erro(404, MENSAGEM_NAO_ENCONTRADA)
    itens.push({
      evolucao: {
        id,
        categoria: evolucao.categoria,
        dados: lerDadosMedica(evolucao.dados),
        texto_livre: evolucao.texto_livre,
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
    })
  }

  // Registro atômico: uma chamada, uma transação no banco.
  const { data: registros, error: erroVias } = await supabase.rpc('registrar_impressoes', {
    p_ids: ids,
    p_chave: chave ?? undefined,
  })
  if (erroVias) {
    if (erroVias.code === 'P0001' && erroVias.message === MENSAGEM_ACESSO_NEGADO) {
      return erro(403, 'Acesso restrito a profissionais clínicos.')
    }
    if (erroVias.code === 'P0001') return erro(404, MENSAGEM_NAO_ENCONTRADA)
    return erro(500, 'Não foi possível registrar a impressão.')
  }
  const viaPorId = new Map((registros ?? []).map((r) => [r.evolucao_id, r.via]))
  if (ids.some((id) => !viaPorId.has(id))) return erro(500, 'Não foi possível registrar a impressão.')

  const buffers: Buffer[] = []
  for (const item of itens) {
    const via = viaPorId.get(item.evolucao.id) ?? 1
    buffers.push(await renderToBuffer(DocumentoEvolucao({ evolucoes: [{ ...item, via }] })))
  }
  const pdf = buffers.length === 1 ? buffers[0] : await juntarPdfs(buffers)
  const nome = ids.length === 1 ? `evolucao-${codigoCurto(ids[0])}.pdf` : `evolucoes-${ids.length}.pdf`

  return new Response(new Uint8Array(pdf), {
    status: 200,
    headers: cabecalhos({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${nome}"`,
    }),
  })
}
