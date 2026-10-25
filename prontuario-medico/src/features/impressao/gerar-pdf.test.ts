// @vitest-environment node
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { renderToBuffer } from '@react-pdf/renderer'
import { PDFParse } from 'pdf-parse'
import { describe, expect, it, vi } from 'vitest'

// Espiona a renderização (sem trocar o resultado) para checar a ordem em relação ao registro de vias.
vi.mock('@react-pdf/renderer', async (importOriginal) => {
  const real = await importOriginal<typeof import('@react-pdf/renderer')>()
  return { ...real, renderToBuffer: vi.fn(real.renderToBuffer) }
})

type Profissional = { id: string; perfil: string; ativo: boolean } | null

const estado: { sub: string | null; profissional: Profissional } = { sub: null, profissional: null }
const tabelas: Record<string, unknown> = {}
const download = vi.fn()
const rpc = vi.fn()

/** Consulta encadeável; awaitável: resolve para a tabela configurada em `tabelas`. */
function consulta(tabela: string) {
  const resultado = () => tabelas[tabela] ?? { data: [], error: null }
  const b: Record<string, unknown> = {
    select: () => b,
    eq: () => b,
    in: () => b,
    order: () => b,
    maybeSingle: async () => ({ data: estado.profissional }),
    then: (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) => Promise.resolve(resultado()).then(ok, ko),
  }
  return b
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: {
      getClaims: async () => ({ data: { claims: estado.sub ? { sub: estado.sub } : {} } }),
    },
    from: (tabela: string) => consulta(tabela),
    storage: { from: () => ({ download }) },
    rpc,
  }),
}))

const { gerarPdf } = await import('./gerar-pdf')
const ID = 'd0000000-0000-0000-0000-000000000001'
const FOTO = readFileSync(path.join(process.cwd(), 'e2e/fixtures/exame.jpg'))
const MENSAGEM_ANEXOS = 'Não foi possível obter os anexos para impressão.'
const MENSAGEM_MUITAS = 'Muitas imagens para imprimir de uma vez. Imprima menos evoluções por vez.'

async function textoDoPdf(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer })
  const resultado = await parser.getText()
  await parser.destroy()
  return resultado.text
}

const IMAGEM = {
  id: 'a0000000-0000-0000-0000-000000000009',
  evolucao_id: ID,
  tipo: 'IMAGEM',
  descricao: 'Raio-X',
  data_exame: '2026-10-24',
  mime: 'image/jpeg',
  storage_path: 'internacoes/b/a',
  tamanho_bytes: 350_000,
}

/** Médico autenticado, evolução finalizada e a lista de anexos dada. */
function prepararFinalizada(anexos: unknown[]) {
  estado.sub = 'a0000000-0000-0000-0000-000000000003'
  estado.profissional = { id: estado.sub, perfil: 'medico', ativo: true }
  tabelas.vw_evolucoes_timeline = {
    data: [
      {
        id: ID,
        internacao_id: 'b0000000-0000-0000-0000-000000000001',
        categoria: 'medica',
        status: 'FINALIZADA',
        dados: {},
        texto_livre: '',
        finalizada_em: '2026-10-25T16:05:00.000Z',
        validada_em: null,
        snapshot_autor: null,
        snapshot_validador: null,
        conteudo_hash: 'abc',
        hash_versao: 2,
      },
    ],
    error: null,
  }
  tabelas.vw_internacoes_lista = {
    data: [
      {
        internacao_id: 'b0000000-0000-0000-0000-000000000001',
        nome: 'Paciente Teste',
        data_nascimento: '1970-03-10',
        convenio: 'SUS',
        leito_ala: 'A-01',
        equipe_nome: 'Cardiologia',
      },
    ],
    error: null,
  }
  tabelas.anexos = { data: anexos, error: null }
  tabelas.impressoes = { data: [], error: null }
  rpc.mockReset()
  rpc.mockResolvedValue({ data: [{ evolucao_id: ID, via: 1 }], error: null })
  download.mockReset()
  vi.mocked(renderToBuffer).mockClear()
}

describe('gerarPdf: autorização', () => {
  it('sem sessão responde 401', async () => {
    estado.sub = null
    const resposta = await gerarPdf([ID])
    expect(resposta.status).toBe(401)
  })

  it('profissional inativo responde 401', async () => {
    estado.sub = 'a0000000-0000-0000-0000-000000000005'
    estado.profissional = { id: estado.sub, perfil: 'medico', ativo: false }
    const resposta = await gerarPdf([ID])
    expect(resposta.status).toBe(401)
  })

  it('recepção responde 403', async () => {
    estado.sub = 'a0000000-0000-0000-0000-000000000004'
    estado.profissional = { id: estado.sub, perfil: 'recepcao', ativo: true }
    const resposta = await gerarPdf([ID])
    expect(resposta.status).toBe(403)
  })

  it('chave de impressão malformada responde 400 antes de consultar', async () => {
    estado.sub = null
    const resposta = await gerarPdf([ID], { chave: 'nao-e-uuid' })
    expect(resposta.status).toBe(400)
  })

  it('id com formato inválido responde 400 antes de consultar', async () => {
    estado.sub = null
    const resposta = await gerarPdf(['nao-e-uuid'])
    expect(resposta.status).toBe(400)
  })
})

describe('gerarPdf: vias', () => {
  it('renderiza antes de registrar as vias e só então responde', async () => {
    prepararFinalizada([])

    const resposta = await gerarPdf([ID])

    expect(resposta.status).toBe(200)
    const renderizou = vi.mocked(renderToBuffer).mock.invocationCallOrder[0]
    const registrou = rpc.mock.invocationCallOrder[0]
    expect(renderizou).toBeLessThan(registrou)
  })

  it('via real diferente da prevista refaz a evolução com a via devolvida pelo banco', async () => {
    prepararFinalizada([])
    rpc.mockResolvedValue({ data: [{ evolucao_id: ID, via: 2 }], error: null })

    const resposta = await gerarPdf([ID])

    expect(resposta.status).toBe(200)
    expect(vi.mocked(renderToBuffer)).toHaveBeenCalledTimes(2)
    expect(await textoDoPdf(Buffer.from(await resposta.arrayBuffer()))).toContain('2ª via')
  })

  it('com chave já registrada, prevê a via existente e não refaz a renderização', async () => {
    prepararFinalizada([])
    tabelas.impressoes = { data: [{ evolucao_id: ID, via: 3 }], error: null }
    rpc.mockResolvedValue({ data: [{ evolucao_id: ID, via: 3 }], error: null })
    const chave = 'c0000000-0000-0000-0000-000000000001'

    const resposta = await gerarPdf([ID], { chave })

    expect(resposta.status).toBe(200)
    expect(rpc).toHaveBeenCalledWith('registrar_impressoes', { p_ids: [ID], p_chave: chave })
    expect(vi.mocked(renderToBuffer)).toHaveBeenCalledTimes(1)
    expect(await textoDoPdf(Buffer.from(await resposta.arrayBuffer()))).toContain('3ª via')
  })

  it('com mais de 10 evoluções e imagens responde 413 antes de qualquer download', async () => {
    prepararFinalizada([IMAGEM])
    download.mockClear()
    const ids = Array.from({ length: 11 }, (_, i) => `d0000000-0000-0000-0000-${String(i + 1).padStart(12, '0')}`)

    const resposta = await gerarPdf(ids, { incluirImagens: true })

    expect(resposta.status).toBe(413)
    expect(await resposta.json()).toEqual({ erro: 'Imprima no máximo 10 evoluções com imagens por vez.' })
    expect(download).not.toHaveBeenCalled()
    expect(rpc).not.toHaveBeenCalled()
  })
})

describe('gerarPdf: anexos', () => {
  it('página de imagem repete nome, D.N. e leito no cabeçalho fixo', async () => {
    prepararFinalizada([IMAGEM])
    download.mockResolvedValue({ data: new Blob([FOTO]), error: null })

    const resposta = await gerarPdf([ID], { incluirImagens: true })

    const texto = await textoDoPdf(Buffer.from(await resposta.arrayBuffer()))
    expect(texto.split('Paciente: Paciente Teste · D.N. 10/03/1970 · Leito A-01').length - 1).toBe(2)
  })

  it('falha ao baixar imagem com anexos=1 responde 500 com mensagem e não registra via', async () => {
    prepararFinalizada([IMAGEM])
    download.mockResolvedValue({ data: null, error: { message: 'objeto ausente' } })

    const resposta = await gerarPdf([ID], { incluirImagens: true })

    expect(resposta.status).toBe(500)
    expect(await resposta.json()).toEqual({ erro: MENSAGEM_ANEXOS })
    expect(rpc).not.toHaveBeenCalled()
  })

  it('falha ao baixar imagem sem anexos=1 imprime com miniatura indisponível e registra via', async () => {
    prepararFinalizada([IMAGEM])
    download.mockResolvedValue({ data: null, error: { message: 'objeto ausente' } })

    const resposta = await gerarPdf([ID])

    expect(resposta.status).toBe(200)
    expect(await textoDoPdf(Buffer.from(await resposta.arrayBuffer()))).toMatch(/Miniatura\s+indisponível/)
    expect(rpc).toHaveBeenCalledWith('registrar_impressoes', expect.anything())
  })

  it('download bem-sucedido com anexos=1 embute a imagem em página própria', async () => {
    prepararFinalizada([IMAGEM])
    download.mockResolvedValue({ data: new Blob([FOTO]), error: null })

    const resposta = await gerarPdf([ID], { incluirImagens: true })

    expect(resposta.status).toBe(200)
    expect(rpc).toHaveBeenCalledWith('registrar_impressoes', expect.anything())
    const texto = await textoDoPdf(Buffer.from(await resposta.arrayBuffer()))
    expect(texto).toContain('Imagem · 24/10/2026 · Raio-X')
    expect(texto).toContain('Página 2 de 2')
  })

  it('imagens acima de 80 MB respondem 413 antes de baixar e não registram via', async () => {
    prepararFinalizada([{ ...IMAGEM, tamanho_bytes: 81 * 1024 * 1024 }])

    const resposta = await gerarPdf([ID])

    expect(resposta.status).toBe(413)
    expect(await resposta.json()).toEqual({ erro: MENSAGEM_MUITAS })
    expect(download).not.toHaveBeenCalled()
    expect(rpc).not.toHaveBeenCalled()
  })
})
