import { renderToBuffer } from '@react-pdf/renderer'
import { PDFDocument } from 'pdf-lib'
import { lerDadosMedica } from '@/features/evolucao/cartao-evolucao'
import { lerDadosSimples } from '@/features/evolucao/modelos/simples'
import { createClient } from '@/lib/supabase/server'
import {
  codigoCurto,
  DocumentoEvolucao,
  type AnexoImpressao,
  type Assinante,
  type EvolucaoImpressao,
} from './documento-evolucao'

type Cliente = Awaited<ReturnType<typeof createClient>>

export type OpcoesPdf = {
  /** Chave idempotente (`k`): mesma chave não gera nova via. */
  chave?: string | null
  /** Acrescenta uma página por imagem anexada, após a evolução. */
  incluirImagens?: boolean
}

type LinhaAnexo = {
  id: string
  evolucao_id: string
  tipo: AnexoImpressao['tipo']
  descricao: string
  data_exame: string
  mime: string
  storage_path: string
  tamanho_bytes: number
}

const LIMITE_BYTES_IMAGENS = 80 * 1024 * 1024
const CONCORRENCIA_DOWNLOADS = 4
const MENSAGEM_ANEXOS = 'Não foi possível obter os anexos para impressão.'
const MENSAGEM_MUITAS_IMAGENS = 'Muitas imagens para imprimir de uma vez. Imprima menos evoluções por vez.'
const MENSAGEM_LIMITE_COM_IMAGENS = 'Imprima no máximo 10 evoluções com imagens por vez.'
/** Com imagens, o PDF é montado de uma vez: acima disso o pedido é recusado antes de qualquer download. */
const MAXIMO_IDS_COM_IMAGENS = 10

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

/** Formatos que o PDF embute sem conversão. WebP e outros não são impressos como imagem. */
function formatoEmbutivel(mime: string): 'jpg' | 'png' | null {
  if (mime === 'image/jpeg') return 'jpg'
  if (mime === 'image/png') return 'png'
  return null
}

/** Executa `fn` em cada item com no máximo `limite` chamadas em paralelo; mantém a ordem dos resultados. */
async function mapaLimitado<T, R>(itens: T[], limite: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const resultados = new Array<R>(itens.length)
  let proximo = 0
  const trabalhador = async () => {
    while (proximo < itens.length) {
      const i = proximo++
      resultados[i] = await fn(itens[i])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limite, itens.length) }, trabalhador))
  return resultados
}

type Carga = { porEvolucao: Map<string, AnexoImpressao[]> } | { resposta: Response }

/**
 * Anexos confirmados, agrupados por evolução. Imagens embutíveis (JPEG/PNG) são baixadas com o cliente
 * do usuário (RLS), com no máximo 4 downloads ao mesmo tempo. Acima de 80 MB de imagens, nada é baixado (413).
 * Falha de download: com `comImagens` a impressão falha (500); sem ele, a miniatura vira "indisponível".
 */
async function carregarAnexos(supabase: Cliente, linhas: LinhaAnexo[], comImagens: boolean): Promise<Carga> {
  const bytesImagens = linhas
    .filter((l) => formatoEmbutivel(l.mime) !== null)
    .reduce((total, l) => total + l.tamanho_bytes, 0)
  if (bytesImagens > LIMITE_BYTES_IMAGENS) return { resposta: erro(413, MENSAGEM_MUITAS_IMAGENS) }

  const anexos = await mapaLimitado(linhas, CONCORRENCIA_DOWNLOADS, async (l): Promise<AnexoImpressao> => {
    const formato = formatoEmbutivel(l.mime)
    const base = { id: l.id, tipo: l.tipo, descricao: l.descricao, dataExame: l.data_exame, mime: l.mime }
    if (!formato) return { ...base, imagem: null, miniaturaIndisponivel: false }
    try {
      const { data, error } = await supabase.storage.from('anexos').download(l.storage_path)
      if (error || !data) throw new Error('download de anexo falhou')
      const bytes = new Uint8Array(await data.arrayBuffer())
      return { ...base, imagem: { data: bytes, formato }, miniaturaIndisponivel: false }
    } catch {
      return { ...base, imagem: null, miniaturaIndisponivel: true }
    }
  })
  if (comImagens && anexos.some((a) => a.miniaturaIndisponivel)) {
    return { resposta: erro(500, MENSAGEM_ANEXOS) }
  }

  const porEvolucao = new Map<string, AnexoImpressao[]>()
  linhas.forEach((l, i) => {
    porEvolucao.set(l.evolucao_id, [...(porEvolucao.get(l.evolucao_id) ?? []), anexos[i]])
  })
  return { porEvolucao }
}

/**
 * Via que cada evolução receberá: a já registrada para a chave (se houver), senão a próxima.
 * Só previsão: quem decide é `registrar_impressoes`, e o chamador confere depois.
 */
async function preverVias(
  supabase: Cliente,
  ids: string[],
  chave: string | null,
  viasImpressas: Map<string, number>,
): Promise<Map<string, number> | null> {
  const existentes = new Map<string, number>()
  if (chave !== null) {
    const { data, error } = await supabase
      .from('impressoes')
      .select('evolucao_id, via')
      .in('evolucao_id', ids)
      .eq('chave', chave)
    if (error) return null
    for (const linha of data ?? []) existentes.set(linha.evolucao_id, linha.via)
  }
  return new Map(ids.map((id) => [id, existentes.get(id) ?? (viasImpressas.get(id) ?? 0) + 1]))
}

/**
 * Gera um PDF A4 com as evoluções finalizadas pedidas, na ordem dos ids.
 * Ordem: valida e monta tudo (inclusive anexos); renderiza com as vias previstas; registra as vias
 * (uma chamada, atômica); só então responde. Se o banco deu via diferente da prevista, a evolução
 * é renderizada de novo com a via real. Cada evolução é paginada à parte.
 */
export async function gerarPdf(ids: string[], opcoes: OpcoesPdf = {}): Promise<Response> {
  const chave = opcoes.chave ?? null
  const incluirImagens = opcoes.incluirImagens ?? false
  if (ids.length === 0 || ids.length > MAXIMO_IDS) return erro(400, 'Informe de 1 a 50 evoluções.')
  if (ids.some((id) => !UUID.test(id))) return erro(400, 'Identificador de evolução inválido.')
  if (new Set(ids).size !== ids.length) return erro(400, 'Evolução repetida na lista.')
  if (chave !== null && !UUID.test(chave)) return erro(400, 'Chave de impressão inválida.')
  if (incluirImagens && ids.length > MAXIMO_IDS_COM_IMAGENS) return erro(413, MENSAGEM_LIMITE_COM_IMAGENS)

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
      'id, internacao_id, categoria, status, dados, texto_livre, finalizada_em, validada_em, snapshot_autor, snapshot_validador, autor_id, validada_por, adendo_de, conteudo_hash, hash_versao, vias_impressas',
    )
    .in('id', ids)
  if (erroEvolucoes) return erro(500, 'Não foi possível gerar o PDF.')

  const porId = new Map((evolucoes ?? []).map((e) => [e.id, e]))
  // Adendo: a original (sempre FINALIZADA, visível pelo mesmo cliente) dá a data e o código do título.
  const origemIds = [...new Set((evolucoes ?? []).map((e) => e.adendo_de).filter((v): v is string => v !== null))]
  const { data: originais, error: erroOriginais } = origemIds.length
    ? await supabase.from('vw_evolucoes_timeline').select('id, status, finalizada_em').in('id', origemIds)
    : { data: [], error: null }
  if (erroOriginais) return erro(500, 'Não foi possível gerar o PDF.')
  const originalPorId = new Map((originais ?? []).map((o) => [o.id, o]))
  // Perfil atual do autor: só para o rótulo de acadêmico sem conselho.
  const autorIds = [...new Set((evolucoes ?? []).map((e) => e.autor_id))]
  const { data: autores, error: erroAutores } = await supabase
    .from('vw_profissionais_publico')
    .select('id, perfil')
    .in('id', autorIds)
  if (erroAutores) return erro(500, 'Não foi possível gerar o PDF.')
  const perfilAutor = new Map((autores ?? []).map((a) => [a.id, a.perfil]))
  const internacaoIds = [...new Set((evolucoes ?? []).map((e) => e.internacao_id))]
  const { data: internacoes, error: erroInternacoes } = await supabase
    .from('vw_internacoes_lista')
    .select('internacao_id, nome, data_nascimento, convenio, leito_ala, equipe_nome')
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
    let adendoDe: { id: string; finalizada_em: string } | null = null
    if (evolucao.adendo_de) {
      const original = originalPorId.get(evolucao.adendo_de)
      if (!original?.finalizada_em || original.status !== 'FINALIZADA') return erro(404, MENSAGEM_NAO_ENCONTRADA)
      adendoDe = { id: original.id, finalizada_em: original.finalizada_em }
    }
    itens.push({
      evolucao: {
        id,
        categoria: evolucao.categoria,
        // Categoria médica (inclusive acadêmico) usa o modelo médico; as demais, o simples.
        dados: evolucao.categoria === 'medica' ? lerDadosMedica(evolucao.dados) : lerDadosSimples(evolucao.dados),
        texto_livre: evolucao.texto_livre,
        finalizada_em: evolucao.finalizada_em,
        validada_em: evolucao.validada_em,
        snapshot_autor: assinante(evolucao.snapshot_autor),
        snapshot_validador: assinante(evolucao.snapshot_validador),
        autor_id: evolucao.autor_id,
        validada_por: evolucao.validada_por,
        autor_perfil: perfilAutor.get(evolucao.autor_id) ?? null,
        adendo_de: adendoDe,
        conteudo_hash: evolucao.conteudo_hash,
        hash_versao: evolucao.hash_versao,
      },
      internacao: {
        leito_ala: internacao.leito_ala ?? '',
        equipe_nome: internacao.equipe_nome ?? '',
      },
      paciente: {
        nome: internacao.nome,
        data_nascimento: internacao.data_nascimento ?? '',
        convenio: internacao.convenio ?? '',
      },
      anexos: [],
    })
  }

  // Anexos: baixados aqui, antes de qualquer via ser registrada.
  const { data: linhasAnexos, error: erroAnexos } = await supabase
    .from('anexos')
    .select('id, evolucao_id, tipo, descricao, data_exame, mime, storage_path, tamanho_bytes')
    .in('evolucao_id', ids)
    .eq('confirmado', true)
    .order('enviado_em', { ascending: true })
  if (erroAnexos) return erro(500, 'Não foi possível gerar o PDF.')
  const carga = await carregarAnexos(supabase, (linhasAnexos ?? []) as LinhaAnexo[], incluirImagens)
  if ('resposta' in carga) return carga.resposta
  for (const item of itens) item.anexos = carga.porEvolucao.get(item.evolucao.id) ?? []

  // Vias previstas antes de renderizar: o PDF já sai com a via que o banco deve gravar.
  const previstas = await preverVias(
    supabase,
    ids,
    chave,
    new Map((evolucoes ?? []).map((e) => [e.id, e.vias_impressas ?? 0])),
  )
  if (!previstas) return erro(500, 'Não foi possível gerar o PDF.')

  const renderizar = (item: Omit<EvolucaoImpressao, 'via'>, via: number) =>
    renderToBuffer(DocumentoEvolucao({ evolucoes: [{ ...item, via }], incluirImagens }))
  const buffers = new Map<string, Buffer>()
  for (const item of itens) {
    buffers.set(item.evolucao.id, await renderizar(item, previstas.get(item.evolucao.id) ?? 1))
  }

  // Registro atômico: uma chamada, uma transação no banco. Só depois a resposta sai.
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

  // Via real diferente da prevista (outra impressão concorrente): refaz só essas evoluções.
  for (const item of itens) {
    const id = item.evolucao.id
    const real = viaPorId.get(id) ?? 1
    if (real !== previstas.get(id)) buffers.set(id, await renderizar(item, real))
  }
  const ordenados = ids.map((id) => buffers.get(id) as Buffer)
  const pdf = ordenados.length === 1 ? ordenados[0] : await juntarPdfs(ordenados)
  const nome = ids.length === 1 ? `evolucao-${codigoCurto(ids[0])}.pdf` : `evolucoes-${ids.length}.pdf`

  return new Response(new Uint8Array(pdf), {
    status: 200,
    headers: cabecalhos({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${nome}"`,
    }),
  })
}
