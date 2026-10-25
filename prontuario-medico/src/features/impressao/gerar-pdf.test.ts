// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'

type Profissional = { id: string; perfil: string; ativo: boolean } | null

const estado: { sub: string | null; profissional: Profissional } = { sub: null, profissional: null }

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: {
      getClaims: async () => ({ data: { claims: estado.sub ? { sub: estado.sub } : {} } }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: estado.profissional }) }),
      }),
    }),
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

  it('id com formato inválido responde 400 antes de consultar', async () => {
    estado.sub = null
    const resposta = await gerarPdf(['nao-e-uuid'])
    expect(resposta.status).toBe(400)
  })
})
