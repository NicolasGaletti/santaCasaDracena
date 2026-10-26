import { expect, test, type Page } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import {
  ADMIN_COM_FATOR, SEGREDO_ADMIN_SEED, codigoTotp, entrarAdmin, tokenAdminAal2,
} from './helpers/mfa'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const SUPABASE_CHAVE =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH'
const FUNCAO_URL = `${SUPABASE_URL}/functions/v1/admin-usuarios`
const MAILPIT_URL = process.env.MAILPIT_URL ?? 'http://127.0.0.1:54324'
const MENSAGEM_NEUTRA = 'Se o e-mail estiver cadastrado, enviaremos um link.'

// Exige `npx supabase functions serve` (playwright webServer) para convidar.
test.skip(({ isMobile }) => isMobile, 'somente desktop')

function emailUnico(): string {
  return `senha-${Math.random().toString(36).slice(2, 10)}@teste.local`
}

async function convidar(email: string): Promise<void> {
  const token = await tokenAdminAal2()
  const resposta = await fetch(FUNCAO_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      apikey: SUPABASE_CHAVE,
    },
    body: JSON.stringify({
      acao: 'convidar', email, nome: `Convidada ${email.slice(6, 12)} (teste)`, funcao: 'enfermagem',
      conselho: 'COREN', numero: '112233', uf: 'SP',
    }),
  })
  expect(resposta.status).toBe(200)
}

/** Espera o e-mail mais recente para o destinatário e devolve o link de ação. */
async function linkDoEmail(email: string, contem: string): Promise<string> {
  let link = ''
  await expect
    .poll(async () => {
      const busca = await fetch(`${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`)
      const json = (await busca.json()) as { messages?: { ID: string; Subject: string }[] }
      for (const m of json.messages ?? []) {
        const msg = (await (await fetch(`${MAILPIT_URL}/api/v1/message/${m.ID}`)).json()) as { Text: string }
        const achado = msg.Text.match(/https?:\/\/\S+token_hash=\S+/)?.[0]
        if (achado && achado.includes(contem)) {
          link = achado
          return true
        }
      }
      return false
    }, { timeout: 15_000 })
    .toBe(true)
  return link
}

async function definirSenha(page: Page, senha: string) {
  await page.getByLabel('Nova senha', { exact: true }).fill(senha)
  await page.getByLabel('Confirmar nova senha').fill(senha)
  await page.getByRole('button', { name: 'Salvar senha' }).click()
}

async function entrar(page: Page, email: string, senha: string) {
  await page.goto('/login')
  await page.getByLabel('E-mail Profissional').fill(email)
  await page.getByLabel('Senha').fill(senha)
  await page.getByRole('button', { name: 'Entrar no Sistema' }).click()
}

test('convidado define senha e entra', async ({ page }) => {
  const email = emailUnico()
  await convidar(email)
  const link = await linkDoEmail(email, 'type=invite')

  await page.goto(link)
  await expect(page).toHaveURL(/\/definir-senha/)

  await definirSenha(page, 'curta1')
  await expect(page.getByText('pelo menos 10 caracteres')).toBeVisible()
  await definirSenha(page, 'somenteletras')
  await expect(page.getByText('uma letra e um número')).toBeVisible()

  await definirSenha(page, 'SenhaForte2026')
  await expect(page).toHaveURL('/')

  await page.context().clearCookies()
  await entrar(page, email, 'SenhaForte2026')
  await expect(page).toHaveURL('/')
})

test('definir-senha sem sessão volta ao login', async ({ page }) => {
  await page.goto('/definir-senha')
  await expect(page).toHaveURL(/\/login/)
})

test('definir-senha com login por senha redireciona para a home', async ({ page }) => {
  await entrarAdmin(page)
  await page.goto('/definir-senha')
  // `/` do admin segue para a lista de profissionais; o que importa é sair de /definir-senha.
  await expect(page).toHaveURL(/localhost:3000\/(admin\/profissionais)?$/)
})

test('recuperação de senha', async ({ page }) => {
  const email = emailUnico()
  await convidar(email)
  await page.goto(await linkDoEmail(email, 'type=invite'))
  await definirSenha(page, 'SenhaForte2026')
  await expect(page).toHaveURL('/')
  await page.context().clearCookies()

  await page.goto('/login')
  await page.getByRole('link', { name: 'Esqueci minha senha' }).click()
  await expect(page).toHaveURL(/\/esqueci-senha/)
  await page.getByLabel('E-mail').fill(email)
  await page.getByRole('button', { name: 'Enviar link' }).click()
  await expect(page.getByText(MENSAGEM_NEUTRA)).toBeVisible()

  await page.goto(await linkDoEmail(email, 'type=recovery'))
  await expect(page).toHaveURL(/\/definir-senha/)
  await definirSenha(page, 'OutraSenha2027')
  await expect(page).toHaveURL('/')

  await page.context().clearCookies()
  await entrar(page, email, 'OutraSenha2027')
  await expect(page).toHaveURL('/')
})

test('admin recupera a senha: link, código do autenticador, nova senha', async ({ page }) => {
  // limpa e-mails antigos do admin semeado para não usar um link vencido
  await fetch(`${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:${ADMIN_COM_FATOR}`)}`, { method: 'DELETE' })

  try {
    await page.goto('/esqueci-senha')
    await page.getByLabel('E-mail').fill(ADMIN_COM_FATOR)
    await page.getByRole('button', { name: 'Enviar link' }).click()
    await expect(page.getByText(MENSAGEM_NEUTRA)).toBeVisible()

    await page.goto(await linkDoEmail(ADMIN_COM_FATOR, 'type=recovery'))
    // sessão do link é aal1 e o admin tem fator: o código vem antes da nova senha
    await expect(page).toHaveURL(/\/mfa\/verificar\?next=%2Fdefinir-senha$/)
    await page.getByLabel('Código de 6 dígitos').fill(await codigoTotp(SEGREDO_ADMIN_SEED))
    await page.getByRole('button', { name: 'Confirmar' }).click()
    await expect(page).toHaveURL(/\/definir-senha$/)

    await definirSenha(page, 'NovaSenhaAdmin2026')
    await expect(page).toHaveURL(/\/admin\/profissionais$/)

    await page.context().clearCookies()
    await entrar(page, ADMIN_COM_FATOR, 'NovaSenhaAdmin2026')
    await expect(page).toHaveURL(/\/mfa\/verificar/)
  } finally {
    await restaurarSenhaAdmin()
  }
})

/** Devolve a senha do seed ao admin (fixture compartilhada pelas outras specs). */
async function restaurarSenhaAdmin() {
  for (const senha of ['NovaSenhaAdmin2026', 'Teste@123']) {
    const cliente = createClient(SUPABASE_URL, SUPABASE_CHAVE, { auth: { persistSession: false } })
    const { error } = await cliente.auth.signInWithPassword({ email: ADMIN_COM_FATOR, password: senha })
    if (error) continue
    const { data: fatores } = await cliente.auth.mfa.listFactors()
    await cliente.auth.mfa.challengeAndVerify({ factorId: fatores!.totp[0].id, code: await codigoTotp(SEGREDO_ADMIN_SEED) })
    const { error: erroSenha } = await cliente.auth.updateUser({ password: 'Teste@123' })
    if (erroSenha && !/different/i.test(erroSenha.message)) throw new Error(`restaurar senha do admin: ${erroSenha.message}`)
    return
  }
  throw new Error('não foi possível restaurar a senha do admin')
}

test('resposta igual para e-mail inexistente', async ({ page }) => {
  await page.goto('/esqueci-senha')
  await page.getByLabel('E-mail').fill(emailUnico())
  await page.getByRole('button', { name: 'Enviar link' }).click()
  await expect(page.getByText(MENSAGEM_NEUTRA)).toBeVisible()
})
