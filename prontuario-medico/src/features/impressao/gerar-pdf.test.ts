// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'

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

describe('gerarPdf: anexos', () => {
  it('falha ao baixar imagem responde 500 e não registra via', async () => {
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
      data: [{ internacao_id: 'b0000000-0000-0000-0000-000000000001', nome: 'Paciente Teste' }],
      error: null,
    }
    tabelas.anexos = {
      data: [
        {
          id: 'a0000000-0000-0000-0000-000000000009',
          evolucao_id: ID,
          tipo: 'IMAGEM',
          descricao: 'Raio-X',
          data_exame: '2026-10-24',
          mime: 'image/jpeg',
          storage_path: 'internacoes/b/a',
        },
      ],
      error: null,
    }
    download.mockResolvedValue({ data: null, error: { message: 'objeto ausente' } })
    rpc.mockReset()

    const resposta = await gerarPdf([ID], { incluirImagens: true })

    expect(resposta.status).toBe(500)
    expect(rpc).not.toHaveBeenCalled()
  })
})
