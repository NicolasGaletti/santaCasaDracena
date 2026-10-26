import { expect, test } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'
import { tokenAdminAal2 } from './helpers/mfa'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const SUPABASE_CHAVE =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH'
const FUNCAO_URL = `${SUPABASE_URL}/functions/v1/admin-usuarios`
const MAILPIT_URL = process.env.MAILPIT_URL ?? 'http://127.0.0.1:54324'
const SENHA = 'Teste@123'

// Exige `npx supabase functions serve` rodando (ver README / relatório da Task 4).
// Serial: o teste de sessão desativa/reativa um usuário compartilhado.
test.describe.configure({ mode: 'serial' })
// API pura + usuário compartilhado: roda só no projeto desktop.
test.skip(({ isMobile }) => isMobile, 'somente desktop')

async function tokenDe(email: string): Promise<string> {
  const cliente = createClient(SUPABASE_URL, SUPABASE_CHAVE, { auth: { persistSession: false } })
  const { data, error } = await cliente.auth.signInWithPassword({ email, password: SENHA })
  if (error || !data.session) throw new Error(`login ${email}: ${error?.message}`)
  return data.session.access_token
}

async function chamar(token: string, corpo: unknown) {
  const resposta = await fetch(FUNCAO_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      apikey: SUPABASE_CHAVE,
    },
    body: JSON.stringify(corpo),
  })
  return { status: resposta.status, corpo: (await resposta.json()) as { ok?: boolean; erro?: string } }
}

function emailUnico(): string {
  return `convite-${Math.random().toString(36).slice(2, 8)}@teste.local`
}

test('admin convida e o e-mail chega no Inbucket', async () => {
  const token = await tokenAdminAal2()
  const email = emailUnico()
  const nome = `Nova Enfermeira ${email.slice(8, 14)} (teste)`
  const r = await chamar(token, {
    acao: 'convidar', email, nome, funcao: 'enfermagem',
    conselho: 'COREN', numero: '998877', uf: 'SP',
  })
  expect(r.status).toBe(200)
  expect(r.corpo).toMatchObject({ ok: true, id: expect.any(String) })

  await expect
    .poll(async () => {
      const busca = await fetch(`${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`)
      const json = (await busca.json()) as { messages_count?: number; total?: number }
      return json.messages_count ?? json.total ?? 0
    }, { timeout: 15_000 })
    .toBeGreaterThan(0)

  // reenvio permitido enquanto o convite não foi aceito
  const admin = createClient(SUPABASE_URL, SUPABASE_CHAVE, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  const { data: linha } = await admin.from('profissionais').select('id, perfil, categoria, conselho').eq('nome', nome)
  expect(linha?.[0]).toMatchObject({ perfil: 'multiprofissional', categoria: 'enfermagem', conselho: 'COREN' })
  // auditoria só é legível pelo perfil auditoria (RLS): consulta direto no Postgres local
  const { data: eu } = await admin.auth.getUser()
  const por = execFileSync(
    'docker',
    ['exec', 'supabase_db_prontuario-medico', 'psql', '-U', 'postgres', '-At', '-c',
      `select por from auditoria where tabela='convites' and registro_id='${linha?.[0].id}'`],
    { encoding: 'utf8' },
  ).trim()
  expect(por).toBe(eu.user?.id)
  const reenvio = await chamar(token, { acao: 'reenviar', profissionalId: linha?.[0].id })
  expect(reenvio.status).toBe(200)
})

test('convite sem conselho exigido é recusado e e-mail duplicado dá 409', async () => {
  const token = await tokenAdminAal2()
  const semConselho = await chamar(token, {
    acao: 'convidar', email: emailUnico(), nome: 'Sem Conselho (teste)', funcao: 'medico',
  })
  expect(semConselho.status).toBe(400)
  expect(semConselho.corpo.erro).toMatch(/conselho/i)

  const duplicado = await chamar(token, {
    acao: 'convidar', email: 'medico1@teste.local', nome: 'Duplicado (teste)', funcao: 'interno',
  })
  expect(duplicado.status).toBe(409)
  expect(duplicado.corpo).toEqual({ erro: 'Este e-mail já está cadastrado.' })
})

test('admin com sessão aal1 recebe 403', async () => {
  const token = await tokenDe('admin@teste.local')
  const r = await chamar(token, {
    acao: 'convidar', email: emailUnico(), nome: 'Sem MFA (teste)', funcao: 'interno',
  })
  expect(r.status).toBe(403)
  expect(r.corpo).toEqual({ erro: 'Confirme o código do autenticador para continuar.' })
})

test('médico recebe 403', async () => {
  const token = await tokenDe('medico1@teste.local')
  const r = await chamar(token, {
    acao: 'convidar', email: emailUnico(), nome: 'Intruso (teste)', funcao: 'interno',
  })
  expect(r.status).toBe(403)
  expect(r.corpo).toEqual({ erro: 'Acesso restrito a administradores.' })
})

test('sem token a função recusa', async () => {
  const resposta = await fetch(FUNCAO_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_CHAVE },
    body: JSON.stringify({ acao: 'desativar', profissionalId: '00000000-0000-0000-0000-000000000000' }),
  })
  expect(resposta.status).toBe(401)
})

test('desativar revoga sessões', async ({ browser }) => {
  const adminToken = await tokenAdminAal2()
  const alvo = 'a0000000-0000-0000-0000-00000000000a' // sessao@teste.local (seed)

  // refresh token emitido antes de desativar: deve morrer mesmo após reativar (sessões revogadas)
  const clienteAntigo = createClient(SUPABASE_URL, SUPABASE_CHAVE, { auth: { persistSession: false } })
  const { data: antigo, error: erroAntigo } = await clienteAntigo.auth.signInWithPassword({
    email: 'sessao@teste.local', password: SENHA,
  })
  expect(erroAntigo).toBeNull()
  const refreshAntigo = antigo.session!.refresh_token

  const contexto = await browser.newContext()
  const pagina = await contexto.newPage()
  try {
    await pagina.goto('/login')
    await pagina.getByLabel('E-mail Profissional').fill('sessao@teste.local')
    await pagina.getByLabel('Senha').fill(SENHA)
    await pagina.getByRole('button', { name: 'Entrar no Sistema' }).click()
    await expect(pagina.getByRole('heading', { name: 'Internados' })).toBeVisible()

    const r = await chamar(adminToken, { acao: 'desativar', profissionalId: alvo })
    expect(r.status).toBe(200)

    await pagina.goto('/')
    await expect(pagina).toHaveURL(/\/login/)
    await expect(pagina.getByRole('heading', { name: 'Internados' })).toHaveCount(0)

    // login novo também é recusado
    const cliente = createClient(SUPABASE_URL, SUPABASE_CHAVE, { auth: { persistSession: false } })
    const { error } = await cliente.auth.signInWithPassword({ email: 'sessao@teste.local', password: SENHA })
    expect(error).not.toBeNull()
  } finally {
    const r = await chamar(adminToken, { acao: 'reativar', profissionalId: alvo })
    expect(r.status).toBe(200)
    await contexto.close()
  }
  const cliente = createClient(SUPABASE_URL, SUPABASE_CHAVE, { auth: { persistSession: false } })
  const { error } = await cliente.auth.signInWithPassword({ email: 'sessao@teste.local', password: SENHA })
  expect(error).toBeNull()

  const { error: erroRefresh } = await createClient(SUPABASE_URL, SUPABASE_CHAVE, {
    auth: { persistSession: false },
  }).auth.refreshSession({ refresh_token: refreshAntigo })
  expect(erroRefresh).not.toBeNull()
})

test('limites de tamanho e reenvio a desativado', async () => {
  const token = await tokenAdminAal2()
  const longo = await chamar(token, {
    acao: 'convidar', email: emailUnico(), nome: 'x'.repeat(201), funcao: 'interno',
  })
  expect(longo.status).toBe(400)

  const alvo = 'a0000000-0000-0000-0000-00000000000a'
  expect((await chamar(token, { acao: 'desativar', profissionalId: alvo })).status).toBe(200)
  try {
    const r = await chamar(token, { acao: 'reenviar', profissionalId: alvo })
    expect(r.status).toBe(400)
    expect(r.corpo.erro).toBe('Profissional desativado. Reative antes de reenviar o convite.')
  } finally {
    expect((await chamar(token, { acao: 'reativar', profissionalId: alvo })).status).toBe(200)
  }
})
