import { expect, test } from '@playwright/test'
import {
  ADMIN_SEM_FATOR, codigoTotp, entrarComSenha, removerFatores,
} from './helpers/mfa'

// Compartilha o admin sem fator entre os testes: em série e só no desktop.
test.describe.configure({ mode: 'serial' })
test.skip(({ isMobile }) => isMobile, 'somente desktop')

let segredo = ''

test.beforeAll(() => removerFatores(ADMIN_SEM_FATOR))
test.afterAll(() => removerFatores(ADMIN_SEM_FATOR))

test('admin sem fator é levado ao cadastro', async ({ page }) => {
  await entrarComSenha(page, ADMIN_SEM_FATOR)
  await expect(page).toHaveURL(/\/mfa\/cadastrar$/)
  await expect(page.getByRole('heading', { name: 'Proteja sua conta' })).toBeVisible()
  await expect(page.getByRole('img', { name: 'QR code para cadastrar o autenticador' })).toBeVisible()

  // rotas protegidas continuam levando ao cadastro enquanto não houver fator
  await page.goto('/admin/profissionais')
  await expect(page).toHaveURL(/\/mfa\/cadastrar$/)

  segredo = (await page.getByTestId('segredo-mfa').innerText()).trim()
  expect(segredo).toMatch(/^[A-Z2-7]{16,}$/)

  await page.getByLabel('Código de 6 dígitos').fill('000000')
  await page.getByRole('button', { name: 'Ativar autenticador' }).click()
  await expect(page.getByText('Código inválido. Confira o app autenticador e tente de novo.')).toBeVisible()

  await page.getByLabel('Código de 6 dígitos').fill(await codigoTotp(segredo))
  await page.getByRole('button', { name: 'Ativar autenticador' }).click()
  await expect(page).toHaveURL(/\/admin\/profissionais$/)
})

test('admin com fator pede código no login', async ({ page }) => {
  await entrarComSenha(page, ADMIN_SEM_FATOR)
  await expect(page).toHaveURL(/\/mfa\/verificar$/)

  // com sessão aal1 a administração não abre
  await page.goto('/admin/equipes')
  await expect(page).toHaveURL(/\/mfa\/verificar$/)

  await page.getByLabel('Código de 6 dígitos').fill('000000')
  await page.getByRole('button', { name: 'Confirmar' }).click()
  await expect(page.getByText('Código inválido. Confira o app autenticador e tente de novo.')).toBeVisible()

  await page.getByLabel('Código de 6 dígitos').fill(await codigoTotp(segredo))
  await page.getByRole('button', { name: 'Confirmar' }).click()
  await expect(page).toHaveURL(/\/admin\/profissionais$/)

  // verificado: /mfa/verificar não prende o admin
  await page.goto('/mfa/verificar')
  await expect(page).toHaveURL(/\/admin\/profissionais$/)
})

test('médico entra só com senha', async ({ page }) => {
  await entrarComSenha(page, 'medico1@teste.local')
  await expect(page.getByRole('heading', { name: 'Internados' })).toBeVisible()
  await expect(page).toHaveURL('/')
})

test('qualquer perfil cadastra autenticador em /conta/seguranca', async ({ page }) => {
  await entrarComSenha(page, 'recepcao@teste.local')
  await expect(page).toHaveURL('/')
  await page.goto('/conta/seguranca')
  await expect(page.getByText('Autenticador não configurado')).toBeVisible()
  await page.getByRole('button', { name: 'Configurar autenticador' }).click()
  const segredoRecepcao = (await page.getByTestId('segredo-mfa').innerText()).trim()
  await page.getByLabel('Código de 6 dígitos').fill(await codigoTotp(segredoRecepcao))
  await page.getByRole('button', { name: 'Ativar autenticador' }).click()
  await expect(page.getByText('Autenticador ativo')).toBeVisible()
  removerFatores('recepcao@teste.local')
})

test('perfil não admin com autenticador ativo pede o código no login e respeita next', async ({ page }) => {
  removerFatores('recepcao@teste.local')
  try {
    await entrarComSenha(page, 'recepcao@teste.local')
    await expect(page).toHaveURL('/')
    await page.goto('/conta/seguranca')
    await page.getByRole('button', { name: 'Configurar autenticador' }).click()
    const segredoRecepcao = (await page.getByTestId('segredo-mfa').innerText()).trim()
    await page.getByLabel('Código de 6 dígitos').fill(await codigoTotp(segredoRecepcao))
    await page.getByRole('button', { name: 'Ativar autenticador' }).click()
    await expect(page.getByText('Autenticador ativo')).toBeVisible()

    // novo login: senha não basta, mesmo sem ser admin
    await page.context().clearCookies()
    await page.goto('/conta/seguranca')
    await expect(page).toHaveURL(/\/login\?next=/)
    await page.getByLabel('E-mail Profissional').fill('recepcao@teste.local')
    await page.getByLabel('Senha').fill('Teste@123')
    await page.getByRole('button', { name: 'Entrar no Sistema' }).click()
    await expect(page).toHaveURL(/\/mfa\/verificar\?next=%2Fconta%2Fseguranca$/)

    // com sessão aal1 nenhuma página protegida abre
    await page.goto('/')
    await expect(page).toHaveURL(/\/mfa\/verificar/)

    await page.goto('/mfa/verificar?next=%2Fconta%2Fseguranca')
    await page.getByLabel('Código de 6 dígitos').fill(await codigoTotp(segredoRecepcao))
    await page.getByRole('button', { name: 'Confirmar' }).click()
    await expect(page).toHaveURL(/\/conta\/seguranca$/)
  } finally {
    removerFatores('recepcao@teste.local')
  }
})

test('next externo em /mfa/verificar é ignorado', async ({ page }) => {
  removerFatores('recepcao@teste.local')
  try {
    await entrarComSenha(page, 'recepcao@teste.local')
    await expect(page).toHaveURL('/')
    await page.goto('/conta/seguranca')
    await page.getByRole('button', { name: 'Configurar autenticador' }).click()
    const seg = (await page.getByTestId('segredo-mfa').innerText()).trim()
    await page.getByLabel('Código de 6 dígitos').fill(await codigoTotp(seg))
    await page.getByRole('button', { name: 'Ativar autenticador' }).click()
    await expect(page.getByText('Autenticador ativo')).toBeVisible()
    await page.context().clearCookies()
    await entrarComSenha(page, 'recepcao@teste.local')
    await expect(page).toHaveURL(/\/mfa\/verificar$/)
    await page.goto('/mfa/verificar?next=https%3A%2F%2Fevil.example%2F')
    await page.getByLabel('Código de 6 dígitos').fill(await codigoTotp(seg))
    await page.getByRole('button', { name: 'Confirmar' }).click()
    await expect(page).toHaveURL('http://localhost:3000/')
  } finally {
    removerFatores('recepcao@teste.local')
  }
})
